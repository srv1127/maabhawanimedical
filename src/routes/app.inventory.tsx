import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Upload, Pencil, Trash2, Search, Download } from "lucide-react";
import Papa from "papaparse";
import { useAuth } from "@/hooks/use-auth";

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
  const [editing, setEditing] = useState<Partial<Medicine> | null>(null);
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

  const save = async () => {
    if (!editing?.name) return toast.error("Name is required");
    const payload = { ...editing };
    delete (payload as any).id;
    const { error } = editing.id
      ? await supabase.from("medicines").update(payload).eq("id", editing.id)
      : await supabase.from("medicines").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["medicines"] });
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
        const { error } = await supabase.from("medicines").insert(rows as any);
        if (error) return toast.error(error.message);
        toast.success(`Imported ${rows.length} medicines`);
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
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setEditing(emptyMed)}><Plus className="size-4 mr-1" />Add Medicine</Button>
                </DialogTrigger>
                <MedicineForm editing={editing} setEditing={setEditing} onSave={save} />
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
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="size-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="size-4" /></Button>
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
    </div>
  );
}

function MedicineForm({ editing, setEditing, onSave }: { editing: Partial<Medicine> | null; setEditing: (m: Partial<Medicine>) => void; onSave: () => void; }) {
  if (!editing) return null;
  const f = (k: keyof Medicine, type: "text" | "number" | "date" = "text") => (
    <Input type={type} value={(editing as any)[k] ?? ""} onChange={(e) => setEditing({ ...editing, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />
  );
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{editing.id ? "Edit Medicine" : "Add Medicine"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="col-span-2"><Label>Name *</Label>{f("name")}</div>
        <div><Label>Generic name</Label>{f("generic_name")}</div>
        <div><Label>Brand</Label>{f("brand")}</div>
        <div><Label>Manufacturer</Label>{f("manufacturer")}</div>
        <div><Label>Batch No.</Label>{f("batch_no")}</div>
        <div><Label>HSN Code</Label>{f("hsn_code")}</div>
        <div><Label>Unit</Label>{f("unit")}</div>
        <div><Label>Pack Size</Label>{f("pack_size", "number")}</div>
        <div><Label>MRP (₹)</Label>{f("mrp", "number")}</div>
        <div><Label>Purchase Price (₹)</Label>{f("purchase_price", "number")}</div>
        <div><Label>Selling Price (₹)</Label>{f("selling_price", "number")}</div>
        <div><Label>GST %</Label>{f("gst_percent", "number")}</div>
        <div><Label>Stock Qty</Label>{f("stock_qty", "number")}</div>
        <div><Label>Reorder Level</Label>{f("reorder_level", "number")}</div>
        <div><Label>Expiry Date</Label>{f("expiry_date", "date")}</div>
        <div><Label>Location</Label>{f("location")}</div>
      </div>
      <DialogFooter><Button onClick={onSave}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
