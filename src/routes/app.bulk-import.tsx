import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { bulkExtractMedicines } from "@/lib/bulk-import.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Upload, Save, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/bulk-import")({
  head: () => ({ meta: [{ title: "Bulk AI Import — PharmaCore" }] }),
  component: BulkImport,
});

type Row = {
  name: string; generic_name: string | null; brand: string | null; manufacturer: string | null;
  batch_no: string | null; pack_size: number; unit: string;
  mrp: number; purchase_price: number; selling_price: number; gst_percent: number;
  stock_qty: number; expiry_date: string | null;
};

function BulkImport() {
  const { user } = useAuth();
  const extract = useServerFn(bulkExtractMedicines);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const runText = async () => {
    if (!text.trim()) return toast.error("Paste a list first");
    setBusy(true);
    try {
      const r = await extract({ data: { text } });
      setRows((r.medicines ?? []).map(normalize));
      toast.success(`Extracted ${r.medicines?.length ?? 0} items`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const runImage = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) return toast.error("Image too large (max 8MB)");
    if (file.type === "image/heic") return toast.error("HEIC not supported. Convert to JPG/PNG.");
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setBusy(true);
      try {
        const r = await extract({ data: { imageBase64: base64, mimeType: file.type || "image/jpeg" } });
        setRows((r.medicines ?? []).map(normalize));
        toast.success(`Extracted ${r.medicines?.length ?? 0} items`);
      } catch (e: any) { toast.error(e.message); }
      finally { setBusy(false); }
    };
    reader.readAsDataURL(file);
  };

  const update = (i: number, k: keyof Row, v: any) => {
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  };

  const saveAll = async () => {
    if (!rows.length) return;
    setSaving(true);
    try {
      const payload = rows.map((r) => ({
        name: r.name, generic_name: r.generic_name, brand: r.brand, manufacturer: r.manufacturer,
        batch_no: r.batch_no, unit: r.unit || "strip", pack_size: Number(r.pack_size) || 1,
        mrp: Number(r.mrp) || 0, purchase_price: Number(r.purchase_price) || 0,
        selling_price: Number(r.selling_price) || Number(r.mrp) || 0,
        gst_percent: Number(r.gst_percent) || 12, stock_qty: Number(r.stock_qty) || 0,
        expiry_date: r.expiry_date || null, created_by: user!.id,
      })).filter((r) => r.name);
      if (!payload.length) return toast.error("No valid rows to save");
      const { error } = await supabase.from("medicines").insert(payload);
      if (error) throw error;
      toast.success(`Added ${payload.length} medicines to inventory`);
      setRows([]); setText("");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="size-6 text-primary" /> Bulk AI Import</h1>
        <p className="text-sm text-muted-foreground">Paste a medicine list or upload a photo — AI fills the table. Review, edit, then save to inventory.</p>
      </div>

      <Card className="p-4">
        <Tabs defaultValue="text">
          <TabsList>
            <TabsTrigger value="text">Paste Text</TabsTrigger>
            <TabsTrigger value="image">Upload Photo</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-3 space-y-2">
            <Label>Medicine list (one per line; include MRP / qty / batch if you have them)</Label>
            <Textarea rows={8} placeholder={"Paracetamol 500mg 10tab MRP 25 qty 50\nCrocin Advance 15tab MRP 45 qty 20\n..."} value={text} onChange={(e) => setText(e.target.value)} />
            <Button onClick={runText} disabled={busy}>
              {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
              Extract with AI
            </Button>
          </TabsContent>
          <TabsContent value="image" className="mt-3">
            <label className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/40">
              <Upload className="size-10 mx-auto text-muted-foreground" />
              <div className="mt-2 font-medium">{busy ? "Analyzing…" : "Click to upload list photo"}</div>
              <div className="text-xs text-muted-foreground">JPG/PNG, max 8MB</div>
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy}
                onChange={(e) => e.target.files?.[0] && runImage(e.target.files[0])} />
            </label>
          </TabsContent>
        </Tabs>
      </Card>

      {rows.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Review ({rows.length}) — edit any cell, then save</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRows([])}>Clear</Button>
              <Button onClick={saveAll} disabled={saving}>
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                Save all to inventory
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Batch</TableHead>
                  <TableHead className="text-right">MRP</TableHead><TableHead className="text-right">Purchase</TableHead>
                  <TableHead className="text-right">Sell</TableHead><TableHead className="text-right">GST%</TableHead>
                  <TableHead className="text-right">Qty</TableHead><TableHead>Expiry</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell><Input value={r.name} onChange={(e) => update(i, "name", e.target.value)} className="min-w-40" /></TableCell>
                    <TableCell><Input value={r.batch_no ?? ""} onChange={(e) => update(i, "batch_no", e.target.value)} className="w-24" /></TableCell>
                    <TableCell><Input type="number" value={r.mrp} onChange={(e) => update(i, "mrp", Number(e.target.value))} className="w-20 text-right" /></TableCell>
                    <TableCell><Input type="number" value={r.purchase_price} onChange={(e) => update(i, "purchase_price", Number(e.target.value))} className="w-20 text-right" /></TableCell>
                    <TableCell><Input type="number" value={r.selling_price} onChange={(e) => update(i, "selling_price", Number(e.target.value))} className="w-20 text-right" /></TableCell>
                    <TableCell><Input type="number" value={r.gst_percent} onChange={(e) => update(i, "gst_percent", Number(e.target.value))} className="w-16 text-right" /></TableCell>
                    <TableCell><Input type="number" value={r.stock_qty} onChange={(e) => update(i, "stock_qty", Number(e.target.value))} className="w-20 text-right" /></TableCell>
                    <TableCell><Input type="date" value={r.expiry_date ?? ""} onChange={(e) => update(i, "expiry_date", e.target.value || null)} className="w-36" /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function normalize(m: any): Row {
  return {
    name: String(m.name ?? "").trim(),
    generic_name: m.generic_name ?? null,
    brand: m.brand ?? null,
    manufacturer: m.manufacturer ?? null,
    batch_no: m.batch_no ?? null,
    pack_size: Number(m.pack_size) || 1,
    unit: m.unit || "strip",
    mrp: Number(m.mrp) || 0,
    purchase_price: Number(m.purchase_price) || Math.round((Number(m.mrp) || 0) * 0.7),
    selling_price: Number(m.selling_price) || Number(m.mrp) || 0,
    gst_percent: Number(m.gst_percent) || 12,
    stock_qty: Number(m.stock_qty) || 0,
    expiry_date: m.expiry_date ?? null,
  };
}
