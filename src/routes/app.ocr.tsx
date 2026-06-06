import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractMedicineFromImage } from "@/lib/ocr.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, ScanLine, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/ocr")({
  head: () => ({ meta: [{ title: "OCR Upload — PharmaCore" }] }),
  component: OcrPage,
});

function OcrPage() {
  const { user } = useAuth();
  const extract = useServerFn(extractMedicineFromImage);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handle = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) return toast.error("Image too large (max 8MB). HEIC not supported — convert to JPG/PNG.");
    if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
      return toast.error("HEIC not supported in browsers. Convert to JPG/PNG first.");
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setBusy(true); setResult(null);
      try {
        const r = await extract({ data: { imageBase64: base64, mimeType: file.type || "image/jpeg" } });
        setResult(r);
        toast.success("Extracted!");
      } catch (e: any) {
        toast.error(e.message);
      } finally { setBusy(false); }
    };
    reader.readAsDataURL(file);
  };

  const saveAsMedicine = async () => {
    if (!result) return;
    const { error } = await supabase.from("medicines").insert({
      name: result.name ?? "Unnamed",
      generic_name: result.generic_name ?? null,
      brand: result.brand ?? null,
      manufacturer: result.manufacturer ?? null,
      batch_no: result.batch_no ?? null,
      mrp: Number(result.mrp ?? 0),
      selling_price: Number(result.mrp ?? 0),
      expiry_date: result.expiry_date ?? null,
      pack_size: Number(result.pack_size ?? 1),
      unit: result.unit ?? "strip",
      stock_qty: 0,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Added to inventory");
    setResult(null); setPreview(null);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScanLine className="size-6 text-primary" />OCR Medicine Upload</h1>
        <p className="text-sm text-muted-foreground">Snap a medicine pack — AI extracts name, batch, expiry & MRP.</p>
      </div>

      <Card className="p-6">
        <label className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/40">
          <Upload className="size-10 mx-auto text-muted-foreground" />
          <div className="mt-2 font-medium">Click to upload medicine photo</div>
          <div className="text-xs text-muted-foreground">JPG/PNG, max 8MB</div>
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
        </label>
      </Card>

      {preview && (
        <Card className="p-4 grid sm:grid-cols-2 gap-4">
          <img src={preview} alt="Upload" className="rounded-md border max-h-72 object-contain w-full" />
          <div>
            {busy && <div className="text-muted-foreground text-sm">Analyzing image…</div>}
            {result && (
              <div className="space-y-2 text-sm">
                <Field label="Name" value={result.name} onChange={(v) => setResult({ ...result, name: v })} />
                <Field label="Generic" value={result.generic_name} onChange={(v) => setResult({ ...result, generic_name: v })} />
                <Field label="Brand" value={result.brand} onChange={(v) => setResult({ ...result, brand: v })} />
                <Field label="Manufacturer" value={result.manufacturer} onChange={(v) => setResult({ ...result, manufacturer: v })} />
                <Field label="Batch" value={result.batch_no} onChange={(v) => setResult({ ...result, batch_no: v })} />
                <Field label="MRP" value={result.mrp} onChange={(v) => setResult({ ...result, mrp: v })} />
                <Field label="Expiry" value={result.expiry_date} onChange={(v) => setResult({ ...result, expiry_date: v })} type="date" />
                <Button onClick={saveAsMedicine} className="w-full mt-2"><Save className="size-4 mr-2" />Add to Inventory</Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: any) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
