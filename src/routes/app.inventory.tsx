import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { inr, fmtDate, daysUntil } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Upload, Pencil, Trash2, Search, Download, PackagePlus, Sparkles, Archive, X } from "lucide-react";
import Papa from "papaparse";
import { useAuth } from "@/hooks/use-auth";
import { GuidedMedicineForm, emptyMedicine, type MedicineDraft } from "@/components/medicine-form";
import { findDuplicates } from "@/lib/dedupe";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/app/inventory")({
  head: () => ({ meta: [{ title: "Inventory — PharmaCore" }] }),
  component: Inventory,
});

type Medicine = {
  id: string; name: string; generic_name: string | null; brand: string | null; manufacturer: string | null;
  batch_no: string | null; hsn_code: string | null; unit: string; pack_size: number;
  mrp: number; purchase_price: number; selling_price: number; gst_percent: number;
  stock_qty: number; reorder_level: number; expiry_date: string | null; location: string | null; is_active: boolean;
};

const emptyMed: Partial<Medicine> = { unit: "strip", pack_size: 1, mrp: 0, purchase_price: 0, selling_price: 0, gst_percent: 12, stock_qty: 0, reorder_level: 10, is_active: true };

function Inventory() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canWrite = hasRole(["admin", "pharmacist"]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MedicineDraft | null>(null);
  const [stockFor, setStockFor] = useState<Medicine | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [stockNote, setStockNote] = useState("");
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: meds = [], isLoading } = useQuery({
    queryKey: ["medicines", search],
    queryFn: async () => {
      let q = supabase.from("medicines").select("*").order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data as Medicine[];
    },
  });

  const closeForm = () => { setOpen(false); setEditing(null); };

  const saveDraft = async (draft: MedicineDraft) => {
    const payload: any = { ...draft };
    delete payload.id;
    const { error } = draft.id
      ? await supabase.from("medicines").update(payload).eq("id", draft.id)
      : await supabase.from("medicines").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(draft.id ? "Medicine updated" : "Medicine created");
    closeForm();
    qc.invalidateQueries({ queryKey: ["medicines"] });
    qc.invalidateQueries({ queryKey: ["medicines-dedupe"] });
  };

  const mergeInto = async (existingId: string, draft: MedicineDraft) => {
    // Update only fields user filled (non-empty); add stock as a movement
    const patch: any = {};
    const copyIf = (k: keyof MedicineDraft) => {
      const v = draft[k];
      if (v !== undefined && v !== null && v !== "" && v !== 0) patch[k] = v;
    };
    (["generic_name","brand","manufacturer","batch_no","barcode","hsn_code","unit","pack_size","mrp","purchase_price","selling_price","gst_percent","reorder_level","expiry_date","location"] as const).forEach(copyIf);
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("medicines").update(patch).eq("id", existingId);
      if (error) { toast.error(error.message); return; }
    }
    const addQty = Number(draft.stock_qty ?? 0);
    if (addQty > 0) {
      const { error } = await supabase.from("stock_movements").insert({
        medicine_id: existingId, type: "purchase", change_qty: addQty,
        notes: "Merged from duplicate add", created_by: user!.id,
      });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(addQty > 0 ? `Merged: +${addQty} stock added` : "Merged into existing");
    closeForm();
    qc.invalidateQueries({ queryKey: ["medicines"] });
    qc.invalidateQueries({ queryKey: ["medicines-dedupe"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this medicine?")) return;
    const { error } = await supabase.from("medicines").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Archived");
    qc.invalidateQueries({ queryKey: ["medicines"] });
  };

  const importCSV = (file: File) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const rows = (res.data as any[]).map((r) => ({
          name: r.name || r.Name,
          generic_name: r.generic_name || r.Generic || null,
          brand: r.brand || null,
          manufacturer: r.manufacturer || null,
          batch_no: r.batch_no || r.batch || null,
          barcode: r.barcode || null,
          hsn_code: r.hsn_code || r.hsn || null,
          unit: r.unit || "strip",
          pack_size: Number(r.pack_size || 1),
          mrp: Number(r.mrp || 0),
          purchase_price: Number(r.purchase_price || 0),
          selling_price: Number(r.selling_price || r.mrp || 0),
          gst_percent: Number(r.gst_percent || 12),
          stock_qty: Number(r.stock_qty || 0),
          reorder_level: Number(r.reorder_level || 10),
          expiry_date: r.expiry_date || null,
          location: r.location || null,
        })).filter((r) => r.name);
        if (!rows.length) return toast.error("No valid rows");

        // Duplicate detection vs existing active medicines
        const { data: existing } = await supabase
          .from("medicines")
          .select("id,name,generic_name,brand,batch_no,barcode")
          .eq("is_active", true).limit(5000);
        const list = (existing ?? []) as any[];
        const fresh: any[] = [];
        const dupes: { row: any; matchId: string; matchName: string }[] = [];
        for (const row of rows) {
          const m = findDuplicates(row, list, { threshold: 0.85, limit: 1 })[0];
          if (m) dupes.push({ row, matchId: m.item.id, matchName: m.item.name });
          else fresh.push(row);
        }

        if (fresh.length) {
          const { error } = await supabase.from("medicines").insert(fresh as any);
          if (error) return toast.error(error.message);
        }

        let merged = 0;
        if (dupes.length && confirm(`${dupes.length} row(s) look like duplicates of existing medicines. Click OK to merge their stock into the matched items, or Cancel to skip them.`)) {
          for (const d of dupes) {
            const qty = Number(d.row.stock_qty || 0);
            if (qty > 0) {
              await supabase.from("stock_movements").insert({
                medicine_id: d.matchId, type: "purchase", change_qty: qty,
                notes: `CSV merge: ${d.row.name}`, created_by: user!.id,
              });
            }
            merged++;
          }
        }
        toast.success(`Imported ${fresh.length} new · ${merged} merged · ${dupes.length - merged} skipped`);
        qc.invalidateQueries({ queryKey: ["medicines"] });
      },
    });
  };

  const exportCSV = () => {
    const csv = Papa.unparse(meds);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `inventory-${Date.now()}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">{meds.length} items</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="size-4 mr-1" />Export</Button>
          {canWrite && (
            <>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="size-4 mr-1" />Import CSV</Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/app/bulk-import"><Sparkles className="size-4 mr-1" />Bulk AI Import</Link>
              </Button>
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => { setEditing(emptyMedicine()); setOpen(true); }}><Plus className="size-4 mr-1" />Add Medicine</Button>
                </DialogTrigger>
                {editing && (
                  <GuidedMedicineForm
                    initial={editing}
                    onSave={saveDraft}
                    onMerge={(existing, draft) => mergeInto(existing.id, draft)}
                    onCancel={closeForm}
                  />
                )}
              </Dialog>
            </>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="relative mb-3">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Batch</TableHead>
                <TableHead className="text-right">MRP</TableHead><TableHead className="text-right">Sell</TableHead>
                <TableHead className="text-right">GST</TableHead><TableHead className="text-right">Stock</TableHead>
                <TableHead>Expiry</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && meds.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No medicines yet.</TableCell></TableRow>}
              {meds.map((m) => {
                const exp = daysUntil(m.expiry_date);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.generic_name ?? m.brand ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-xs">{m.batch_no ?? "—"}</TableCell>
                    <TableCell className="text-right">{inr(m.mrp)}</TableCell>
                    <TableCell className="text-right">{inr(m.selling_price)}</TableCell>
                    <TableCell className="text-right">{m.gst_percent}%</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={m.stock_qty === 0 ? "destructive" : m.stock_qty <= m.reorder_level ? "secondary" : "outline"}>{m.stock_qty}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {fmtDate(m.expiry_date)}
                      {exp !== null && exp < 60 && <div className={exp < 0 ? "text-destructive" : "text-warning"}>{exp < 0 ? "Expired" : `${exp}d left`}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      {canWrite && (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" title="Add stock" onClick={() => { setStockFor(m); setStockQty(0); setStockNote(""); }}><PackagePlus className="size-4" /></Button>
                          <Button size="icon" variant="ghost" title="Edit" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="size-4" /></Button>
                          <Button size="icon" variant="ghost" title="Archive" onClick={() => remove(m.id)}><Trash2 className="size-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!stockFor} onOpenChange={(o) => !o && setStockFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add stock — {stockFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Current stock: <span className="font-semibold text-foreground">{stockFor?.stock_qty ?? 0}</span></div>
            <div><Label>Quantity to add</Label><Input type="number" min={1} value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} autoFocus /></div>
            <div><Label>Note (optional)</Label><Input value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="Supplier / invoice ref" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockFor(null)}>Cancel</Button>
            <Button disabled={stockQty <= 0} onClick={async () => {
              if (!stockFor || stockQty <= 0) return;
              const { error } = await supabase.from("stock_movements").insert({
                medicine_id: stockFor.id, type: "purchase", change_qty: stockQty,
                notes: stockNote || "Manual stock-in", created_by: user!.id,
              });
              if (error) return toast.error(error.message);
              toast.success(`+${stockQty} added to ${stockFor.name}`);
              setStockFor(null);
              qc.invalidateQueries({ queryKey: ["medicines"] });
            }}>Add stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

