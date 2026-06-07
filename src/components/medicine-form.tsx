import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { findDuplicates, type DupeMatch } from "@/lib/dedupe";
import { AlertTriangle, ChevronLeft, ChevronRight, Check, Merge } from "lucide-react";
import { inr } from "@/lib/format";

export type MedicineDraft = {
  id?: string;
  name?: string;
  generic_name?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  batch_no?: string | null;
  barcode?: string | null;
  hsn_code?: string | null;
  unit?: string;
  pack_size?: number;
  mrp?: number;
  purchase_price?: number;
  selling_price?: number;
  gst_percent?: number;
  stock_qty?: number;
  reorder_level?: number;
  expiry_date?: string | null;
  location?: string | null;
  is_active?: boolean;
};

type ExistingMed = MedicineDraft & { id: string };

export function emptyMedicine(): MedicineDraft {
  return {
    unit: "strip", pack_size: 1, mrp: 0, purchase_price: 0, selling_price: 0,
    gst_percent: 12, stock_qty: 0, reorder_level: 10, is_active: true,
  };
}

const steps = ["Identity", "Pricing & Tax", "Stock & Expiry"] as const;

export function GuidedMedicineForm({
  initial,
  onSave,
  onMerge,
  onCancel,
}: {
  initial: MedicineDraft;
  onSave: (m: MedicineDraft) => Promise<void> | void;
  onMerge?: (existing: ExistingMed, draft: MedicineDraft) => Promise<void> | void;
  onCancel: () => void;
}) {
  const isEdit = !!initial.id;
  const [draft, setDraft] = useState<MedicineDraft>({ ...emptyMedicine(), ...initial });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof MedicineDraft>(k: K, v: MedicineDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Pull a slim list of existing medicines for live dedupe (skipped when editing)
  const { data: existing = [] } = useQuery({
    enabled: !isEdit,
    queryKey: ["medicines-dedupe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicines")
        .select("id,name,generic_name,brand,batch_no,barcode,stock_qty,mrp,selling_price,purchase_price,expiry_date")
        .eq("is_active", true)
        .limit(2000);
      if (error) throw error;
      return data as ExistingMed[];
    },
  });

  const dupes: DupeMatch<ExistingMed>[] = useMemo(() => {
    if (isEdit) return [];
    if (!draft.name && !draft.barcode) return [];
    return findDuplicates(draft, existing, { threshold: 0.7, limit: 4 });
  }, [draft.name, draft.generic_name, draft.batch_no, draft.barcode, existing, isEdit]);

  const canNext = step === 0 ? !!draft.name?.trim() : true;
  const isLast = step === steps.length - 1;

  const handleSave = async () => {
    if (!draft.name?.trim()) return;
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Medicine" : "Add New Medicine"}</DialogTitle>
        <DialogDescription>
          Step {step + 1} of {steps.length} — {steps[step]}
        </DialogDescription>
      </DialogHeader>

      {/* Progress */}
      <div className="flex gap-1.5 mb-1">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand / Display name *" className="col-span-2">
              <Input autoFocus value={draft.name ?? ""} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Crocin Advance 500mg" />
            </Field>
            <Field label="Generic name">
              <Input value={draft.generic_name ?? ""} onChange={(e) => update("generic_name", e.target.value)} placeholder="Paracetamol" />
            </Field>
            <Field label="Manufacturer">
              <Input value={draft.manufacturer ?? ""} onChange={(e) => update("manufacturer", e.target.value)} placeholder="GSK" />
            </Field>
            <Field label="Barcode">
              <Input value={draft.barcode ?? ""} onChange={(e) => update("barcode", e.target.value)} placeholder="Scan or type" />
            </Field>
            <Field label="HSN Code">
              <Input value={draft.hsn_code ?? ""} onChange={(e) => update("hsn_code", e.target.value)} />
            </Field>
            <Field label="Unit">
              <Input value={draft.unit ?? "strip"} onChange={(e) => update("unit", e.target.value)} placeholder="strip / bottle / box" />
            </Field>
            <Field label="Pack size">
              <Input type="number" min={1} value={draft.pack_size ?? 1} onChange={(e) => update("pack_size", Number(e.target.value))} />
            </Field>

            {dupes.length > 0 && (
              <Alert variant="destructive" className="col-span-2">
                <AlertTriangle className="size-4" />
                <AlertTitle>Possible duplicate{dupes.length > 1 ? "s" : ""} found</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-2">
                    {dupes.map((d) => (
                      <div key={d.item.id} className="flex items-center justify-between gap-2 rounded border bg-background p-2">
                        <div className="text-sm">
                          <div className="font-medium text-foreground">{d.item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {d.item.generic_name ?? "—"} · Batch {d.item.batch_no ?? "—"} · Stock {d.item.stock_qty ?? 0} · {inr(d.item.selling_price ?? 0)}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {d.reasons.map((r, i) => <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>)}
                          </div>
                        </div>
                        {onMerge && (
                          <Button size="sm" variant="outline" onClick={() => onMerge(d.item, draft)}>
                            <Merge className="size-4 mr-1" /> Merge
                          </Button>
                        )}
                      </div>
                    ))}
                    <p className="text-xs">Merge updates the existing entry and adds your stock to it. Or continue to create a new entry.</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="MRP (₹)"><Input type="number" min={0} step="0.01" value={draft.mrp ?? 0} onChange={(e) => update("mrp", Number(e.target.value))} /></Field>
            <Field label="GST %"><Input type="number" min={0} value={draft.gst_percent ?? 12} onChange={(e) => update("gst_percent", Number(e.target.value))} /></Field>
            <Field label="Purchase price (₹) *"><Input type="number" min={0} step="0.01" value={draft.purchase_price ?? 0} onChange={(e) => update("purchase_price", Number(e.target.value))} /></Field>
            <Field label="Selling price (₹) *"><Input type="number" min={0} step="0.01" value={draft.selling_price ?? 0} onChange={(e) => update("selling_price", Number(e.target.value))} /></Field>
            <div className="col-span-2 rounded border bg-muted/40 p-3 text-sm">
              Margin: <span className="font-semibold">
                {draft.selling_price && draft.purchase_price
                  ? `${(((Number(draft.selling_price) - Number(draft.purchase_price)) / Math.max(1, Number(draft.selling_price))) * 100).toFixed(1)}%`
                  : "—"}
              </span>
              {draft.selling_price && draft.purchase_price && Number(draft.selling_price) < Number(draft.purchase_price) && (
                <span className="ml-2 text-destructive">Sell price below cost!</span>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Batch No.">
              <Input value={draft.batch_no ?? ""} onChange={(e) => update("batch_no", e.target.value)} />
            </Field>
            <Field label="Expiry date">
              <Input type="date" value={draft.expiry_date ?? ""} onChange={(e) => update("expiry_date", e.target.value || null)} />
            </Field>
            <Field label={isEdit ? "Stock qty (use 'Add stock' to add more)" : "Initial stock (optional)"}>
              <Input type="number" min={0} value={draft.stock_qty ?? 0} onChange={(e) => update("stock_qty", Number(e.target.value))} />
            </Field>
            <Field label="Reorder level">
              <Input type="number" min={0} value={draft.reorder_level ?? 10} onChange={(e) => update("reorder_level", Number(e.target.value))} />
            </Field>
            <Field label="Location" className="col-span-2">
              <Input value={draft.location ?? ""} onChange={(e) => update("location", e.target.value)} placeholder="Rack A-3" />
            </Field>
          </div>
        )}
      </div>

      <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={saving}><ChevronLeft className="size-4 mr-1" />Back</Button>}
          {!isLast && <Button onClick={() => setStep(step + 1)} disabled={!canNext}>Next<ChevronRight className="size-4 ml-1" /></Button>}
          {isLast && <Button onClick={handleSave} disabled={saving || !draft.name?.trim()}><Check className="size-4 mr-1" />{isEdit ? "Save changes" : "Create medicine"}</Button>}
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
