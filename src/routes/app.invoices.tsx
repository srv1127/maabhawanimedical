import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { inr, fmtDateTime } from "@/lib/format";
import { Eye, Printer } from "lucide-react";
import { generateInvoicePDF } from "@/lib/pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SimplePagination, paginate } from "@/components/simple-pagination";

const PAGE_SIZE = 25;

export const Route = createFileRoute("/app/invoices")({
  head: () => ({ meta: [{ title: "Invoices — PharmaCore" }] }),
  component: Invoices,
});

function Invoices() {
  const [from, setFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [viewId, setViewId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: sales = [] } = useQuery({
    queryKey: ["invoices", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*")
        .gte("created_at", from).lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: viewDetail } = useQuery({
    queryKey: ["invoice-detail", viewId],
    enabled: !!viewId,
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("*, sale_items(*, medicines(name, batch_no))").eq("id", viewId!).single();
      return data;
    },
  });

  const reprint = async (id: string) => {
    const { data } = await supabase.from("sales").select("*, sale_items(*, medicines(name, batch_no))").eq("id", id).single();
    if (!data) return;
    generateInvoicePDF({
      invoice_no: data.invoice_no, created_at: data.created_at,
      customer_name: data.customer_name, customer_phone: data.customer_phone, doctor_name: data.doctor_name,
      payment_method: data.payment_method, subtotal: Number(data.subtotal), discount: Number(data.discount), tax: Number(data.tax), total: Number(data.total),
      items: (data.sale_items as any[]).map((it) => ({
        name: it.medicines?.name ?? "Item", batch: it.medicines?.batch_no, qty: it.qty,
        mrp: Number(it.mrp), unit_price: Number(it.unit_price), gst_percent: Number(it.gst_percent), line_total: Number(it.line_total),
      })),
    });
  };

  const summary = sales.reduce((acc: any, s: any) => {
    acc.total += Number(s.total); acc.profit += Number(s.profit); acc.count++;
    return acc;
  }, { total: 0, profit: 0, count: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><h1 className="text-2xl font-bold">Invoices</h1></div>
        <div className="ml-auto flex flex-wrap gap-2 items-end">
          <div><label className="text-xs">From</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="text-xs">To</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Invoices</div><div className="text-xl font-bold">{summary.count}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Revenue</div><div className="text-xl font-bold">{inr(summary.total)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Profit</div><div className="text-xl font-bold text-success">{inr(summary.profit)}</div></Card>
      </div>

      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Profit</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No invoices in this range.</TableCell></TableRow>}
            {paginate(sales, page, PAGE_SIZE).rows.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.invoice_no}</TableCell>
                <TableCell className="text-xs">{fmtDateTime(s.created_at)}</TableCell>
                <TableCell>{s.customer_name ?? "Walk-in"}</TableCell>
                <TableCell><Badge variant="outline">{s.payment_method}</Badge></TableCell>
                <TableCell className="text-right font-semibold">{inr(s.total)}</TableCell>
                <TableCell className="text-right text-success">{inr(s.profit)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setViewId(s.id)}><Eye className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => reprint(s.id)}><Printer className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <SimplePagination page={page} pages={paginate(sales, page, PAGE_SIZE).pages} total={sales.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </Card>

      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Invoice {viewDetail?.invoice_no}</DialogTitle></DialogHeader>
          {viewDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Date: </span>{fmtDateTime(viewDetail.created_at)}</div>
                <div><span className="text-muted-foreground">Payment: </span>{viewDetail.payment_method}</div>
                <div><span className="text-muted-foreground">Customer: </span>{viewDetail.customer_name ?? "Walk-in"}</div>
                <div><span className="text-muted-foreground">Phone: </span>{viewDetail.customer_phone ?? "—"}</div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(viewDetail.sale_items as any[]).map((it) => (
                    <TableRow key={it.id}><TableCell>{it.medicines?.name}</TableCell><TableCell className="text-right">{it.qty}</TableCell><TableCell className="text-right">{inr(it.unit_price)}</TableCell><TableCell className="text-right">{inr(it.line_total)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span>{inr(viewDetail.total)}</span></div>
              <Button onClick={() => reprint(viewDetail.id)} className="w-full"><Printer className="size-4 mr-2" />Reprint PDF</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
