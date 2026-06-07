import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  text: z.string().max(50_000).optional(),
  imageBase64: z.string().max(15_000_000).optional(),
  mimeType: z.string().max(64).optional(),
}).refine((d) => d.text || d.imageBase64, { message: "Provide text or image" });

const SYSTEM = `You are a pharmacy inventory assistant. The user gives you a list of medicines (typed, pasted from invoice, or photographed). Extract every distinct medicine line and return STRICT JSON of the shape:
{"medicines":[{"name":string,"generic_name":string|null,"brand":string|null,"manufacturer":string|null,"batch_no":string|null,"pack_size":number,"unit":string,"mrp":number,"purchase_price":number,"selling_price":number,"gst_percent":number,"stock_qty":number,"expiry_date":string|null}]}

Rules:
- unit: one of "strip","bottle","tube","box","piece"
- pack_size: tablets per strip / ml per bottle etc. Default 10 for strips, 1 otherwise
- gst_percent: default 12 unless clearly stated
- expiry_date: YYYY-MM-DD or null
- If purchase_price is missing, estimate it as ~70% of MRP
- If selling_price is missing, use MRP
- If stock_qty missing, default 0
- Use null for unknown strings, 0 for unknown numbers (except defaults above)
- Return JSON only, no commentary, no markdown fences.`;

export const bulkExtractMedicines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: any[] = [];
    if (data.text) userContent.push({ type: "text", text: `Medicines list:\n${data.text}` });
    if (data.imageBase64) {
      userContent.push({ type: "text", text: "Extract every medicine from this image." });
      userContent.push({ type: "image_url", image_url: { url: `data:${data.mimeType ?? "image/jpeg"};base64,${data.imageBase64}` } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit. Wait a moment and retry.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace billing.");
    if (!res.ok) throw new Error(`AI gateway error: ${res.status} ${await res.text()}`);

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { medicines: [] }; }
    const meds = Array.isArray(parsed.medicines) ? parsed.medicines : [];
    return { medicines: meds };
  });
