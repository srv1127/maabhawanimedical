import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { bulkExtractMedicines } from "@/lib/bulk-import.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Upload, Save, Trash2, Loader2, AlertTriangle, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { findDuplicates } from "@/lib/dedupe";
import { SimplePagination, paginate } from "@/components/simple-pagination";

export const Route = createFileRoute("/app/bulk-import")({
  head: () => ({ meta: [{ title: "Bulk AI Import — PharmaCore" }] }),
  component: BulkImport,
});

type Row = {
  name: string; generic_name: string | null; brand: string | null; manufacturer: string | null;
  batch_no: string | null; pack_size: number; unit: string;
  mrp: number; purchase_price: number; selling_price: number; gst_percent: number;
  stock_qty: number; expiry_date: string | null;
  _dupId?: string | null; _dupName?: string | null; _action?: "new" | "merge" | "skip";
};

const PAGE_SIZE = 20;

function BulkImport() {
  const { user } = useAuth();
  const extract = useServerFn(bulkExtractMedicines);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [threshold, setThreshold] = useState(0.82);
  const [lastExisting, setLastExisting] = useState<any[] | null>(null);

  const dupCount = useMemo(() => rows.filter((r) => r._dupId).length, [rows]);
  const paged = paginate(rows, page, PAGE_SIZE);

  const matchRows = (rs: Row[], list: any[], th: number): Row[] =>
    rs.map((r) => {
      const m = findDuplicates(r, list, { threshold: th, limit: 1 })[0];
      if (m) {
        const action: "new" | "merge" | "skip" = r._action === "skip" || r._action === "new" ? r._action : "merge";
        return { ...r, _dupId: m.item.id, _dupName: m.item.name, _action: action };
      }
      return { ...r, _dupId: null, _dupName: null, _action: "new" as const };
    });

  const checkDuplicates = async (rs: Row[]): Promise<Row[]> => {
    const { data: existing } = await supabase
      .from("medicines")
      .select("id,name,generic_name,brand,batch_no,barcode")
      .eq("is_active", true)
      .limit(5000);
    const list = (existing ?? []) as any[];
    setLastExisting(list);
    return matchRows(rs, list, threshold);
  };

  const rerunMatching = (th: number) => {
    if (!lastExisting || !rows.length) return;
    setRows((rs) => matchRows(rs, lastExisting, th));
  };


  const runText = async () => {
    if (!text.trim()) return toast.error("Paste a list first");
    setBusy(true);
    try {
      const r = await extract({ data: { text } });
      const norm = (r.medicines ?? []).map(normalize);
      const checked = await checkDuplicates(norm);
      setRows(checked); setPage(1);
      const d = checked.filter((x) => x._dupId).length;
      toast.success(`Extracted ${checked.length} items${d ? ` · ${d} duplicate(s) found in inventory` : ""}`);
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
        const norm = (r.medicines ?? []).map(normalize);
        const checked = await checkDuplicates(norm);
        setRows(checked); setPage(1);
        const d = checked.filter((x) => x._dupId).length;
        toast.success(`Extracted ${checked.length} items${d ? ` · ${d} duplicate(s) found in inventory` : ""}`);
      } catch (e: any) { toast.error(e.message); }
      finally { setBusy(false); }
    };
    reader.readAsDataURL(file);
  };

  const update = (i: number, k: keyof Row, v: any) => {
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  };

  const setAllDupes = (action: "merge" | "skip") => {
    setRows((rs) => rs.map((r) => r._dupId ? { ...r, _action: action } : r));
  };

  const saveAll = async () => {
    if (!rows.length) return;
    setSaving(true);
    try {
      const fresh = rows.filter((r) => !r._dupId || r._action === "new").filter((r) => r.name);
      const merges = rows.filter((r) => r._dupId && r._action === "merge");
      const skipped = rows.filter((r) => r._dupId && r._action === "skip").length;

      let inserted = 0;
      if (fresh.length) {
        const payload = fresh.map((r) => ({
          name: r.name, generic_name: r.generic_name, brand: r.brand, manufacturer: r.manufacturer,
          batch_no: r.batch_no, unit: r.unit || "strip", pack_size: Number(r.pack_size) || 1,
          mrp: Number(r.mrp) || 0, purchase_price: Number(r.purchase_price) || 0,
          selling_price: Number(r.selling_price) || Number(r.mrp) || 0,
          gst_percent: Number(r.gst_percent) || 12, stock_qty: Number(r.stock_qty) || 0,
          expiry_date: r.expiry_date || null, created_by: user!.id,
        }));
        const { error } = await supabase.from("medicines").insert(payload);
        if (error) throw error;
        inserted = payload.length;
      }

      let merged = 0;
      for (const m of merges) {
        const qty = Number(m.stock_qty || 0);
        const patch: any = {};
        if (m.mrp) patch.mrp = Number(m.mrp);
        if (m.selling_price) patch.selling_price = Number(m.selling_price);
        if (m.purchase_price) patch.purchase_price = Number(m.purchase_price);
        if (m.expiry_date) patch.expiry_date = m.expiry_date;
        if (m.batch_no) patch.batch_no = m.batch_no;
        if (Object.keys(patch).length) {
          await supabase.from("medicines").update(patch).eq("id", m._dupId!);
        }
        if (qty > 0) {
          await supabase.from("stock_movements").insert({
            medicine_id: m._dupId!, type: "purchase", change_qty: qty,
            notes: `Bulk AI merge: ${m.name}`, created_by: user!.id,
          });
        }
        merged++;
      }

      toast.success(`Saved · ${inserted} new · ${merged} merged · ${skipped} skipped`);
      setRows([]); setText(""); setPage(1);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="size-6 text-primary" /> Bulk AI Import</h1>
        <p className="text-sm text-muted-foreground">Paste a medicine list or upload a photo — AI fills the table and checks for duplicates already in your inventory.</p>
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

      <Card className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="size-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold mb-1">Duplicate detection rules</div>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
              <li><strong>Barcode</strong> — exact match on normalized barcode overrides everything (score = 1.00).</li>
              <li><strong>Name / generic + strength</strong> — token-set similarity on normalized name and generic name (dosage units like mg/ml stripped); generic weighted 0.9×.</li>
              <li><strong>Batch</strong> — same batch number on top of a name match ≥ 0.5 adds +0.15 to the score.</li>
              <li><strong>Similarity threshold</strong> — rows scoring ≥ the threshold below are flagged as duplicates.</li>
            </ul>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Label className="text-sm">Similarity threshold</Label>
          <div className="flex items-center gap-3 flex-1 min-w-64 max-w-md">
            <Slider
              value={[Math.round(threshold * 100)]}
              min={50} max={100} step={1}
              onValueChange={(v) => { const t = v[0] / 100; setThreshold(t); rerunMatching(t); }}
            />
            <span className="text-sm font-mono w-14 text-right">{Math.round(threshold * 100)}%</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {threshold >= 0.9 ? "Strict — only near-identical matches" : threshold >= 0.75 ? "Balanced (recommended)" : "Loose — more false positives"}
          </span>
        </div>
      </Card>


      {rows.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold">Review ({rows.length}) — edit, then save</h2>
            <div className="flex gap-2">
              {dupCount > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setAllDupes("merge")}>Merge all duplicates</Button>
                  <Button size="sm" variant="outline" onClick={() => setAllDupes("skip")}>Skip all duplicates</Button>
                </>
              )}
              <Button variant="outline" onClick={() => setRows([])}>Clear</Button>
              <Button onClick={saveAll} disabled={saving}>
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                Save to inventory
              </Button>
            </div>
          </div>

          {dupCount > 0 && (
            <div className="mb-3 flex items-center gap-2 text-sm text-warning bg-warning/10 border border-warning/30 rounded-md px-3 py-2">
              <AlertTriangle className="size-4" />
              <span><strong>{dupCount}</strong> item(s) match medicines already in your inventory. Choose <em>Merge</em> (add stock to existing), <em>Skip</em>, or <em>New</em> (force-create) per row.</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead><TableHead>Batch</TableHead>
                  <TableHead className="text-right">MRP</TableHead><TableHead className="text-right">Purchase</TableHead>
                  <TableHead className="text-right">Sell</TableHead><TableHead className="text-right">GST%</TableHead>
                  <TableHead className="text-right">Qty</TableHead><TableHead>Expiry</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.rows.map((r) => {
                  const i = rows.indexOf(r);
                  return (
                    <TableRow key={i} className={r._dupId && r._action !== "skip" ? "bg-warning/5" : r._action === "skip" ? "opacity-50" : ""}>
                      <TableCell className="min-w-36">
                        {r._dupId ? (
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-warning border-warning">Duplicate</Badge>
                            <div className="text-[10px] text-muted-foreground truncate max-w-32" title={r._dupName ?? ""}>↳ {r._dupName}</div>
                            <select
                              className="text-xs border rounded px-1 py-0.5 bg-background w-full"
                              value={r._action ?? "merge"}
                              onChange={(e) => update(i, "_action", e.target.value as any)}
                            >
                              <option value="merge">Merge stock</option>
                              <option value="skip">Skip</option>
                              <option value="new">Add as new</option>
                            </select>
                          </div>
                        ) : (
                          <Badge variant="secondary">New</Badge>
                        )}
                      </TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <SimplePagination page={paged.page} pages={paged.pages} total={paged.total} pageSize={PAGE_SIZE} onPage={setPage} />
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
