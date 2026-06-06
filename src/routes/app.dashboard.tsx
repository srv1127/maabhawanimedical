import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { inr, fmtDate, daysUntil } from "@/lib/format";
import { Package, ShoppingCart, AlertTriangle, Calendar, TrendingUp, IndianRupee } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PharmaCore" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const start7 = new Date(Date.now() - 7 * 86400000).toISOString();
      const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

      const [meds, salesToday, sales7, lowStock, nearExpiry] = await Promise.all([
        supabase.from("medicines").select("id, stock_qty, selling_price, purchase_price", { count: "exact" }).eq("is_active", true),
        supabase.from("sales").select("total, profit, payment_method, created_at").gte("created_at", startToday),
        supabase.from("sales").select("total, profit, created_at").gte("created_at", start7).order("created_at"),
        supabase.from("medicines").select("id, name, stock_qty, reorder_level").lte("stock_qty", 10).eq("is_active", true).order("stock_qty").limit(8),
        supabase.from("medicines").select("id, name, expiry_date, stock_qty").lte("expiry_date", in60).gte("expiry_date", new Date().toISOString().slice(0,10)).eq("is_active", true).order("expiry_date").limit(8),
      ]);

      const totalStockValue = (meds.data ?? []).reduce((s, m) => s + Number(m.purchase_price) * m.stock_qty, 0);
      const todayRev = (salesToday.data ?? []).reduce((s, x) => s + Number(x.total), 0);
      const todayProfit = (salesToday.data ?? []).reduce((s, x) => s + Number(x.profit), 0);

      // Group sales last 7 days
      const byDay: Record<string, { date: string; revenue: number; profit: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        byDay[d] = { date: d.slice(5), revenue: 0, profit: 0 };
      }
      for (const s of sales7.data ?? []) {
        const d = (s.created_at as string).slice(0, 10);
        if (byDay[d]) { byDay[d].revenue += Number(s.total); byDay[d].profit += Number(s.profit); }
      }
      const chart = Object.values(byDay);

      return {
        totalMeds: meds.count ?? 0,
        totalStockValue,
        todayRev,
        todayProfit,
        todayCount: salesToday.data?.length ?? 0,
        lowStock: lowStock.data ?? [],
        nearExpiry: nearExpiry.data ?? [],
        chart,
      };
    },
  });

  const kpis = [
    { label: "Today's Revenue", value: inr(stats?.todayRev ?? 0), icon: IndianRupee, hint: `${stats?.todayCount ?? 0} invoices` },
    { label: "Today's Profit", value: inr(stats?.todayProfit ?? 0), icon: TrendingUp, hint: "Gross margin" },
    { label: "Active Medicines", value: stats?.totalMeds ?? 0, icon: Package, hint: "In catalogue" },
    { label: "Stock Value", value: inr(stats?.totalStockValue ?? 0), icon: ShoppingCart, hint: "At purchase price" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live overview of inventory, sales and alerts.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <k.icon className="size-4 text-primary" />
            </div>
            <div className="text-2xl font-bold mt-2">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{k.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-semibold mb-3">Revenue & Profit (7 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.chart ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" stroke="var(--success)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="size-4 text-warning" />Low Stock</h3>
          <div className="space-y-2 text-sm">
            {(stats?.lowStock ?? []).length === 0 && <div className="text-muted-foreground text-xs">All good.</div>}
            {stats?.lowStock.map((m) => (
              <div key={m.id} className="flex justify-between items-center border-b pb-1 last:border-0">
                <span className="truncate">{m.name}</span>
                <span className={m.stock_qty === 0 ? "text-destructive font-semibold" : "text-warning font-semibold"}>{m.stock_qty}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="size-4 text-destructive" />Expiring within 60 days</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
          {(stats?.nearExpiry ?? []).length === 0 && <div className="text-muted-foreground text-xs">No items expiring soon.</div>}
          {stats?.nearExpiry.map((m) => {
            const days = daysUntil(m.expiry_date);
            return (
              <div key={m.id} className="rounded border p-2">
                <div className="font-medium truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(m.expiry_date)} · {days}d · qty {m.stock_qty}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
