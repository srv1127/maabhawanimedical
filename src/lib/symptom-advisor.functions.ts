import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  symptoms: z.string().min(3).max(2000),
  ageYears: z.number().int().min(0).max(120).optional(),
  sex: z.enum(["male", "female", "other"]).optional(),
  pregnant: z.boolean().optional(),
  allergies: z.string().max(500).optional(),
  conditions: z.string().max(500).optional(),
});

const SYSTEM = `You are a clinical pharmacy assistant helping a licensed pharmacist at an Indian retail pharmacy.
The user describes a patient's symptoms. You must recommend OTC / common medicines ONLY from the provided in-stock inventory.

Return STRICT JSON:
{
 "assessment": string,                    // 1-2 sentence problem summary
 "red_flags": string[],                   // when to refer to a doctor (empty if none)
 "suggestions": [{
   "medicine_id": string,                 // MUST be an id from the provided inventory
   "name": string,                        // copy from inventory
   "reason": string,                      // why this medicine fits the symptoms
   "dosage": string,                      // typical adult OTC dosage, brief
   "duration": string,                    // e.g. "3-5 days"
   "cautions": string,                    // allergies/pregnancy/interactions etc.
   "confidence": "high"|"medium"|"low"
 }],
 "advice": string                          // lifestyle / non-drug advice
}

Rules:
- Use ONLY medicine_id values present in the inventory JSON the user provides. Do not invent IDs or names.
- Prefer items with stock_qty > 0 and not expired.
- If symptoms suggest something serious (chest pain, severe bleeding, stroke signs, high fever in infants, pregnancy complications, suspected fracture, allergic reaction with breathing trouble, etc.) keep suggestions minimal and put strong red_flags.
- If patient is pregnant or has stated allergies, exclude contraindicated drugs.
- Max 5 suggestions, best first.
- JSON only, no markdown fences, no commentary.`;

export const suggestMedicines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { supabase } = context;
    const { data: meds, error } = await supabase
      .from("medicines")
      .select("id,name,generic_name,brand,manufacturer,unit,pack_size,mrp,selling_price,stock_qty,expiry_date")
      .eq("is_active", true)
      .gt("stock_qty", 0)
      .order("name")
      .limit(600);
    if (error) throw new Error(error.message);

    const today = new Date().toISOString().slice(0, 10);
    const inventory = (meds ?? []).filter((m: any) => !m.expiry_date || m.expiry_date >= today);

    const patient = [
      data.ageYears != null ? `Age: ${data.ageYears}` : null,
      data.sex ? `Sex: ${data.sex}` : null,
      data.pregnant ? "Pregnant: yes" : null,
      data.allergies ? `Allergies: ${data.allergies}` : null,
      data.conditions ? `Conditions/medications: ${data.conditions}` : null,
    ].filter(Boolean).join(" | ") || "Not specified";

    const userPrompt = `Patient: ${patient}
Symptoms: ${data.symptoms}

In-stock inventory (JSON):
${JSON.stringify(inventory)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace billing.");
    if (!res.ok) throw new Error(`AI gateway error: ${res.status} ${await res.text()}`);

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = {}; }

    const idSet = new Set(inventory.map((m: any) => m.id));
    const byId = new Map(inventory.map((m: any) => [m.id, m]));
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s: any) => s && idSet.has(s.medicine_id))
          .slice(0, 5)
          .map((s: any) => {
            const m: any = byId.get(s.medicine_id);
            return {
              medicine_id: s.medicine_id,
              name: m?.name ?? s.name,
              stock_qty: m?.stock_qty ?? 0,
              selling_price: m?.selling_price ?? 0,
              reason: s.reason ?? "",
              dosage: s.dosage ?? "",
              duration: s.duration ?? "",
              cautions: s.cautions ?? "",
              confidence: s.confidence ?? "medium",
            };
          })
      : [];

    return {
      assessment: typeof parsed.assessment === "string" ? parsed.assessment : "",
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String) : [],
      advice: typeof parsed.advice === "string" ? parsed.advice : "",
      suggestions,
      inventory_size: inventory.length,
    };
  });
