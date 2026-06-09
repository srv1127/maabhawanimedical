import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAdvisorHistory } from "@/lib/symptom-advisor.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { History, ArrowLeft, Stethoscope, Calendar, AlertTriangle, Sparkles, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/advisor/history")({
  head: () => ({ meta: [{ title: "AI Advisor History — PharmaCore" }] }),
  component: HistoryPage,
});

type SuggestionRow = {
  id: string;
  medicine_id: string;
  name: string;
  stock_qty: number;
  selling_price: number;
  reason: string;
  dosage: string;
  duration: string;
  cautions: string;
  confidence: string;
  rank: number;
};

type SessionRow = {
  id: string;
  symptoms: string;
  age_years: number | null;
  sex: string | null;
  pregnant: boolean;
  allergies: string | null;
  conditions: string | null;
  assessment: string;
  red_flags: string[];
  advice: string;
  inventory_size: number;
  created_at: string;
  advisor_suggestions: SuggestionRow[];
};

function HistoryPage() {
  const fetchHistory = useServerFn(listAdvisorHistory);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchHistory({ data: {} })
      .then((r) => {
        if (mounted) setSessions((r as any).sessions ?? []);
      })
      .catch((e: any) => toast.error(e?.message ?? "Failed to load history"))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [fetchHistory]);

  const confColor = (c: string) =>
    c === "high" ? "default" : c === "low" ? "secondary" : "outline";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="size-6" /> AI Advisor History
          </h1>
          <p className="text-sm text-muted-foreground">View and compare past AI recommendations.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/advisor"><ArrowLeft className="size-4 mr-1" /> Back to Advisor</Link>
        </Button>
      </div>

      {loading && (
        <Card className="p-6 text-sm text-muted-foreground">Loading history…</Card>
      )}

      {!loading && sessions.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          No advisor sessions yet. Use the <Link to="/app/advisor" className="underline">AI Advisor</Link> to generate recommendations.
        </Card>
      )}

      <div className="space-y-3">
        {sessions.map((s) => {
          const isOpen = openId === s.id;
          return (
            <Card key={s.id} className="p-4">
              <button
                className="w-full text-left"
                onClick={() => setOpenId(isOpen ? null : s.id)}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{s.symptoms}</span>
                      <Badge variant="outline" className="text-[10px]">
                        <Calendar className="size-3 mr-1" />
                        {new Date(s.created_at).toLocaleString()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{s.advisor_suggestions?.length ?? 0} suggestions</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.assessment || "No assessment"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Age: {s.age_years ?? "—"} · Sex: {s.sex ?? "—"} {s.pregnant ? "· Pregnant" : ""}
                      {s.allergies ? ` · Allergies: ${s.allergies}` : ""}
                      {s.conditions ? ` · Conditions: ${s.conditions}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 mt-1">
                    {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="mt-3 space-y-3">
                  <Separator />
                  {s.assessment && (
                    <div className="text-sm">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Assessment</span>
                      <div>{s.assessment}</div>
                    </div>
                  )}
                  {s.red_flags && s.red_flags.length > 0 && (
                    <div className="text-sm border border-destructive/30 rounded-md p-2 bg-destructive/5">
                      <div className="flex items-center gap-2 text-destructive font-semibold mb-1">
                        <AlertTriangle className="size-4" /> Refer to doctor if:
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        {s.red_flags.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  {s.advisor_suggestions && s.advisor_suggestions.length > 0 ? (
                    <div className="grid gap-2">
                      {s.advisor_suggestions.map((g) => (
                        <div key={g.id} className="rounded-md border p-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-semibold">{g.name}</div>
                                <Badge variant={confColor(g.confidence) as any}>{g.confidence} confidence</Badge>
                                <Badge variant="outline">Stock: {g.stock_qty}</Badge>
                                <Badge variant="outline">{inr(g.selling_price)}</Badge>
                              </div>
                              <div className="text-sm mt-1">{g.reason}</div>
                              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                                {g.dosage && <div><span className="text-muted-foreground">Dosage:</span> {g.dosage}</div>}
                                {g.duration && <div><span className="text-muted-foreground">Duration:</span> {g.duration}</div>}
                                {g.cautions && <div className="sm:col-span-2"><span className="text-muted-foreground">Cautions:</span> {g.cautions}</div>}
                              </div>
                            </div>
                            <Button asChild size="sm" variant="outline">
                              <Link to="/app/sales"><ShoppingCart className="size-4 mr-1" /> Add to sale</Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No suggestions recorded.</div>
                  )}
                  {s.advice && (
                    <div className="text-sm">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">General advice</span>
                      <div className="whitespace-pre-wrap">{s.advice}</div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    ⚠️ AI suggestions are decision support only. A licensed pharmacist must verify dose, interactions, and contraindications before dispensing.
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
