import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: "Reports — PharmaCore" }] }),
  component: Reports,
});

function Reports() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [expenses, setExpenses] = useState(0);

  const { data: dayData } = useQuery({
    queryKey: ["day-report", date],
    queryFn: async () => {
      const start = date + "T00:00:00";
      const end = date + "T23:59:59";
      const { data: salesData } = await supabase.from("sales").select("*").gte("created_at", start).lte("created_at", end);
      const sales = salesData ?? [];
      const { data: closing } = await supabase.from("daily_closings").select("*").eq("closing_date", date).maybeSingle();
      const split = { cash: 0, card: 0, upi: 0, credit: 0 };
      let total = 0, profit = 0;
      for (const s of sales as any[]) {
        total += Number(s.total); profit += Number(s.profit);
        split[s.payment_method as keyof typeof split] += Number(s.total);
      }
      return { sales: sales as any[], split, total, profit, count: sales.length, closing };
    },
  });

  const saveClosing = async () => {
    if (!dayData) return;
    const payload = {
      closing_date: date, total_sales: dayData.total, total_invoices: dayData.count, total_profit: dayData.profit,
      cash_total: dayData.split.cash, card_total: dayData.split.card, upi_total: dayData.split.upi, credit_total: dayData.split.credit,
      opening_cash: openingCash, closing_cash: closingCash, expenses, created_by: user!.id,
    };
    const { error } = await supabase.from("daily_closings").upsert(payload, { onConflict: "closing_date" });
    if (error) return toast.error(error.message);
    toast.success("Daily closing saved");
    qc.invalidateQueries({ queryKey: ["day-report"] });
  };

  const exportPDF = () => {
    if (!dayData) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Daily Closing Report", 14, 18);
    doc.setFontSize(10); doc.text(`Date: ${date}`, 14, 26);
    autoTable(doc, {
      startY: 34,
      head: [["Metric", "Value"]],
      body: [
        ["Total Invoices", String(dayData.count)],
        ["Revenue", inr(dayData.total)],
        ["Profit", inr(dayData.profit)],
        ["Cash", inr(dayData.split.cash)],
        ["Card", inr(dayData.split.card)],
        ["UPI", inr(dayData.split.upi)],
        ["Credit", inr(dayData.split.credit)],
        ["Opening Cash", inr(openingCash)],
        ["Closing Cash", inr(closingCash)],
        ["Expenses", inr(expenses)],
      ],
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Invoice", "Customer", "Total", "Profit"]],
      body: dayData.sales.map((s: any) => [s.invoice_no, s.customer_name ?? "Walk-in", inr(s.total), inr(s.profit)]),
    });
    doc.save(`closing-${date}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><h1 className="text-2xl font-bold">Daily Closing Report</h1></div>
        <div className="ml-auto flex gap-2 items-end">
          <div><label className="text-xs">Date</label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <Button variant="outline" onClick={exportPDF}><Download className="size-4 mr-1" />PDF</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Invoices</div><div className="text-xl font-bold">{dayData?.count ?? 0}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Revenue</div><div className="text-xl font-bold">{inr(dayData?.total ?? 0)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Profit</div><div className="text-xl font-bold text-success">{inr(dayData?.profit ?? 0)}</div></Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Payment split</div>
          <div className="text-xs space-y-0.5">
            <div>Cash: {inr(dayData?.split.cash ?? 0)}</div>
            <div>Card: {inr(dayData?.split.card ?? 0)}</div>
            <div>UPI: {inr(dayData?.split.upi ?? 0)}</div>
            <div>Credit: {inr(dayData?.split.credit ?? 0)}</div>
          </div>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Cash Reconciliation</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><label className="text-xs">Opening Cash</label><Input type="number" value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} /></div>
          <div><label className="text-xs">Closing Cash</label><Input type="number" value={closingCash} onChange={(e) => setClosingCash(Number(e.target.value))} /></div>
          <div><label className="text-xs">Expenses</label><Input type="number" value={expenses} onChange={(e) => setExpenses(Number(e.target.value))} /></div>
        </div>
        <div className="text-sm">
          Expected closing cash: <span className="font-semibold">{inr(openingCash + (dayData?.split.cash ?? 0) - expenses)}</span>
          {" · "}Difference: <span className="font-semibold">{inr(closingCash - (openingCash + (dayData?.split.cash ?? 0) - expenses))}</span>
        </div>
        <Button onClick={saveClosing}>Save Closing</Button>
      </Card>

      <Card className="p-4 overflow-x-auto">
        <h3 className="font-semibold mb-3">Invoices for {date}</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Profit</TableHead></TableRow></TableHeader>
          <TableBody>
            {(dayData?.sales ?? []).map((s: any) => (
              <TableRow key={s.id}><TableCell className="text-xs">{s.invoice_no}</TableCell><TableCell>{s.customer_name ?? "Walk-in"}</TableCell><TableCell>{s.payment_method}</TableCell><TableCell className="text-right">{inr(s.total)}</TableCell><TableCell className="text-right text-success">{inr(s.profit)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
