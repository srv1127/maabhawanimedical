import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestMedicines } from "@/lib/symptom-advisor.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, AlertTriangle, Sparkles, Loader2, ShoppingCart, History } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/app/advisor")({
  head: () => ({ meta: [{ title: "AI Advisor — PharmaCore" }] }),
  component: Advisor,
});

type Suggestion = {
  medicine_id: string;
  name: string;
  stock_qty: number;
  selling_price: number;
  reason: string;
  dosage: string;
  duration: string;
  cautions: string;
  confidence: "high" | "medium" | "low";
};
type Result = {
  assessment: string;
  red_flags: string[];
  advice: string;
  suggestions: Suggestion[];
  inventory_size: number;
};

function Advisor() {
  const ask = useServerFn(suggestMedicines);
  const [symptoms, setSymptoms] = useState("");
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<"male" | "female" | "other" | "">("");
  const [pregnant, setPregnant] = useState(false);
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    if (symptoms.trim().length < 3) return toast.error("Describe the symptoms");
    setLoading(true); setResult(null);
    try {
      const r = await ask({
        data: {
          symptoms: symptoms.trim(),
          ageYears: age ? Number(age) : undefined,
          sex: sex || undefined,
          pregnant: pregnant || undefined,
          allergies: allergies.trim() || undefined,
          conditions: conditions.trim() || undefined,
        },
      });
      setResult(r as Result);
      if (!r.suggestions.length) toast.message("No in-stock match found for these symptoms");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  };

  const confColor = (c: string) =>
    c === "high" ? "default" : c === "low" ? "secondary" : "outline";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Stethoscope className="size-6" /> AI Symptom Advisor</h1>
          <p className="text-sm text-muted-foreground">Describe the patient's problem — AI suggests medicines from your in-stock inventory.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs"><Sparkles className="size-3 mr-1" /> Pharmacist must verify</Badge>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/advisor/history"><History className="size-4 mr-1" /> View history</Link>
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div>
          <Label>Patient's symptoms / complaint</Label>
          <Textarea
            rows={4}
            placeholder="e.g. Fever 101°F since yesterday, headache, body ache, no cough"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <Label>Age</Label>
            <Input type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 32" />
          </div>
          <div>
            <Label>Sex</Label>
            <Select value={sex} onValueChange={(v) => setSex(v as any)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Checkbox id="preg" checked={pregnant} onCheckedChange={(v) => setPregnant(!!v)} />
            <Label htmlFor="preg" className="cursor-pointer">Pregnant / nursing</Label>
          </div>
          <div className="md:col-span-1 col-span-2">
            <Label>Known allergies</Label>
            <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. penicillin" />
          </div>
          <div className="md:col-span-1 col-span-2">
            <Label>Conditions / current meds</Label>
            <Input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. diabetes, BP meds" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
            Suggest medicines
          </Button>
        </div>
      </Card>

      {result && (
        <div className="space-y-4">
          {result.assessment && (
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Assessment</div>
              <div className="text-sm">{result.assessment}</div>
              <div className="text-xs text-muted-foreground mt-2">Checked against {result.inventory_size} in-stock items.</div>
            </Card>
          )}

          {result.red_flags.length > 0 && (
            <Card className="p-4 border-destructive/40 bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
                <AlertTriangle className="size-4" /> Refer to doctor if:
              </div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {result.red_flags.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </Card>
          )}

          {result.suggestions.length > 0 ? (
            <div className="grid gap-3">
              {result.suggestions.map((s) => (
                <Card key={s.medicine_id} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-lg">{s.name}</div>
                        <Badge variant={confColor(s.confidence) as any}>{s.confidence} confidence</Badge>
                        <Badge variant="outline">Stock: {s.stock_qty}</Badge>
                        <Badge variant="outline">{inr(s.selling_price)}</Badge>
                      </div>
                      <div className="text-sm mt-2">{s.reason}</div>
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
                        {s.dosage && <div><span className="text-muted-foreground">Dosage:</span> {s.dosage}</div>}
                        {s.duration && <div><span className="text-muted-foreground">Duration:</span> {s.duration}</div>}
                        {s.cautions && <div className="sm:col-span-2"><span className="text-muted-foreground">Cautions:</span> {s.cautions}</div>}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/app/sales"><ShoppingCart className="size-4 mr-1" /> Add to sale</Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-4 text-sm text-muted-foreground">No suitable in-stock medicine matched. Consider restocking or referring the patient.</Card>
          )}

          {result.advice && (
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">General advice</div>
              <div className="text-sm whitespace-pre-wrap">{result.advice}</div>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            ⚠️ AI suggestions are decision support only. A licensed pharmacist must verify dose, interactions, and contraindications before dispensing.
          </p>
        </div>
      )}
    </div>
  );
}
