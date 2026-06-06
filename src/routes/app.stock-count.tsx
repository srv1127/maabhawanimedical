import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/app/stock-count")({
  head: () => ({ meta: [{ title: "Stock Verification — PharmaCore" }] }),
  component: StockCount,
});

function StockCount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: counts = [] } = useQuery({
    queryKey: ["counts"],
    queryFn: async () => {
      const { data } = await supabase.from("physical_counts").select("*").order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["count-items", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data } = await supabase.from("physical_count_items").select("*, medicines(name, batch_no, stock_qty)").eq("count_id", activeId!);
      return data ?? [];
    },
  });

  const startNew = async () => {
    const { data: meds } = await supabase.from("medicines").select("id, stock_qty").eq("is_active", true);
    if (!meds?.length) return toast.error("No medicines yet");
    const { data: pc, error } = await supabase.from("physical_counts").insert({ created_by: user!.id, notes: "Stock take" }).select().single();
    if (error) return toast.error(error.message);
    const itemsPayload = meds.map((m) => ({ count_id: pc.id, medicine_id: m.id, system_qty: m.stock_qty, counted_qty: m.stock_qty }));
    await supabase.from("physical_count_items").insert(itemsPayload);
    toast.success("New stock count created");
    qc.invalidateQueries({ queryKey: ["counts"] });
    setActiveId(pc.id);
  };

  const updateCount = async (id: string, counted: number) => {
    await supabase.from("physical_count_items").update({ counted_qty: counted }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["count-items", activeId] });
  };

  const finalize = async () => {
    if (!activeId) return;
    if (!confirm("Finalize this count and adjust stock to match counted quantities?")) return;
    const diffs = items.filter((it: any) => it.difference !== 0);
    for (const it of diffs as any[]) {
      await supabase.from("stock_movements").insert({
        medicine_id: it.medicine_id, type: "adjustment", change_qty: it.difference,
        reference_id: activeId, notes: `Stock verification adjustment`,
      });
    }
    await supabase.from("physical_counts").update({ status: "finalized", finalized_at: new Date().toISOString() }).eq("id", activeId);
    toast.success(`Adjusted ${diffs.length} items`);
    qc.invalidateQueries();
    setActiveId(null);
  };

  const diffsCount = items.filter((it: any) => it.difference !== 0).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold">Physical Stock Verification</h1><p className="text-sm text-muted-foreground">Reconcile system vs actual stock.</p></div>
        <Button onClick={startNew}>+ New Count</Button>
      </div>

      {!activeId && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Recent Counts</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {counts.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No counts yet. Start one to verify your inventory.</TableCell></TableRow>}
              {counts.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{fmtDate(c.count_date)}</TableCell>
                  <TableCell><Badge variant={c.status === "finalized" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setActiveId(c.id)}>Open</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeId && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Counting {items.length} items · {diffsCount} differences</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setActiveId(null)}>Back</Button>
              <Button onClick={finalize}>Finalize & Adjust</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="text-right">System</TableHead><TableHead className="text-right">Counted</TableHead><TableHead className="text-right">Difference</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((it: any) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.medicines?.name}</TableCell>
                    <TableCell className="text-right">{it.system_qty}</TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className="w-24 ml-auto" defaultValue={it.counted_qty} onBlur={(e) => updateCount(it.id, Number(e.target.value))} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={it.difference === 0 ? "text-muted-foreground" : it.difference > 0 ? "text-success" : "text-destructive"}>
                        {it.difference > 0 ? `+${it.difference}` : it.difference}
                      </span>
                    </TableCell>
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
