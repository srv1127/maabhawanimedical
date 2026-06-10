import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Receipt, Search } from "lucide-react";
import { inr, round2 } from "@/lib/format";
import { toast } from "sonner";
import { generateInvoicePDF } from "@/lib/pdf";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/sales")({
  head: () => ({ meta: [{ title: "New Sale — PharmaCore" }] }),
  component: SalesPOS,
});

type Med = { id: string; name: string; batch_no: string | null; mrp: number; selling_price: number; purchase_price: number; gst_percent: number; stock_qty: number; };
type CartItem = Med & { qty: number; discount: number };

function SalesPOS() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", doctor: "" });
  const [payment, setPayment] = useState<"cash" | "card" | "upi" | "credit">("cash");
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: results = [] } = useQuery({
    queryKey: ["pos-search", search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const { data } = await supabase.from("medicines")
        .select("id,name,batch_no,mrp,selling_price,purchase_price,gst_percent,stock_qty")
        .ilike("name", `%${search}%`).eq("is_active", true).gt("stock_qty", 0).limit(8);
      return (data ?? []) as Med[];
    },
  });

  const addToCart = (m: Med) => {
    setCart((c) => {
      const ex = c.find((x) => x.id === m.id);
      if (ex) return c.map((x) => x.id === m.id ? { ...x, qty: Math.min(x.qty + 1, m.stock_qty) } : x);
      return [...c, { ...m, qty: 1, discount: 0 }];
    });
    setSearch("");
  };

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0, profit = 0;
    cart.forEach((it) => {
      const gross = it.selling_price * it.qty;
      const lineDisc = it.discount;
      const taxable = gross - lineDisc;
      const gst = (taxable * it.gst_percent) / (100 + it.gst_percent); // price-inclusive GST
      const net = taxable;
      subtotal += net - gst;
      tax += gst;
      profit += (it.selling_price - it.purchase_price) * it.qty - lineDisc;
    });
    const total = Math.max(0, subtotal + tax - orderDiscount);
    return { subtotal, tax, total, profit: profit - orderDiscount, discount: orderDiscount + cart.reduce((s, x) => s + x.discount, 0) };
  }, [cart, orderDiscount]);

  const checkout = async () => {
    if (!cart.length) return toast.error("Cart is empty");
    setSaving(true);
    try {
      const { data: invNo, error: invErr } = await supabase.rpc("next_invoice_no");
      if (invErr) throw invErr;

      const { data: sale, error: sErr } = await supabase.from("sales").insert({
        invoice_no: invNo as string,
        customer_name: customer.name || null,
        customer_phone: customer.phone || null,
        doctor_name: customer.doctor || null,
        subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total, profit: totals.profit,
        payment_method: payment, created_by: user!.id,
      }).select().single();
      if (sErr) throw sErr;

      const items = cart.map((it) => ({
        sale_id: sale.id, medicine_id: it.id, qty: it.qty,
        unit_price: it.selling_price, purchase_price: it.purchase_price,
        mrp: it.mrp, gst_percent: it.gst_percent, discount: it.discount,
        line_total: it.selling_price * it.qty - it.discount,
      }));
      const { error: iErr } = await supabase.from("sale_items").insert(items);
      if (iErr) throw iErr;

      generateInvoicePDF({
        invoice_no: sale.invoice_no, created_at: sale.created_at,
        customer_name: customer.name, customer_phone: customer.phone, doctor_name: customer.doctor,
        payment_method: payment, subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total,
        items: cart.map((it) => ({ name: it.name, batch: it.batch_no, qty: it.qty, mrp: it.mrp, unit_price: it.selling_price, gst_percent: it.gst_percent, line_total: it.selling_price * it.qty - it.discount })),
      });

      toast.success(`Invoice ${sale.invoice_no} generated`);
      setCart([]); setCustomer({ name: "", phone: "", doctor: "" }); setOrderDiscount(0);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Search className="size-4" />Search medicine</h2>
          <Input placeholder="Type medicine name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {results.length > 0 && (
            <div className="mt-2 border rounded-md divide-y">
              {results.map((m) => (
                <button key={m.id} type="button" onClick={() => addToCart(m)}
                  className="w-full flex justify-between items-center p-3 hover:bg-accent text-left">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">Batch {m.batch_no ?? "-"} · Stock {m.stock_qty}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{inr(m.selling_price)}</div>
                    <div className="text-xs text-muted-foreground">MRP {inr(m.mrp)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Cart ({cart.length})</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Item</TableHead><TableHead className="text-right">MRP</TableHead><TableHead className="text-right">Sell Price</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Disc</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {cart.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Add medicines to start a sale.</TableCell></TableRow>}
                {cart.map((it, idx) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">GST {it.gst_percent}%</div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground line-through">{inr(it.mrp)}</TableCell>
                    <TableCell className="text-right font-semibold">{inr(it.selling_price)}</TableCell>
                    <TableCell className="text-right">
                      <Input type="number" min={1} max={it.stock_qty} value={it.qty} className="w-20 ml-auto"
                        onChange={(e) => setCart((c) => c.map((x, i) => i === idx ? { ...x, qty: Math.min(Number(e.target.value), it.stock_qty) } : x))} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" min={0} value={it.discount} className="w-20 ml-auto"
                        onChange={(e) => setCart((c) => c.map((x, i) => i === idx ? { ...x, discount: Number(e.target.value) } : x))} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">{inr(it.selling_price * it.qty - it.discount)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}><Trash2 className="size-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Card className="p-4 space-y-3 h-fit lg:sticky lg:top-4">
        <h2 className="font-semibold">Checkout</h2>
        <div><Label>Customer name</Label><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Walk-in" /></div>
        <div><Label>Phone</Label><Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></div>
        <div><Label>Doctor (optional)</Label><Input value={customer.doctor} onChange={(e) => setCustomer({ ...customer, doctor: e.target.value })} /></div>
        <div>
          <Label>Payment</Label>
          <Select value={payment} onValueChange={(v: any) => setPayment(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem>
              <SelectItem value="upi">UPI</SelectItem><SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Extra Discount (₹)</Label><Input type="number" min={0} value={orderDiscount} onChange={(e) => setOrderDiscount(Number(e.target.value))} /></div>
        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span>GST</span><span>{inr(totals.tax)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>−{inr(totals.discount)}</span></div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span>{inr(totals.total)}</span></div>
          <div className="flex justify-between text-xs text-success"><span>Est. Profit</span><span>{inr(totals.profit)}</span></div>
        </div>
        <Button className="w-full" disabled={saving || !cart.length} onClick={checkout}>
          <Receipt className="size-4 mr-2" />{saving ? "Processing…" : "Generate Invoice"}
        </Button>
      </Card>
    </div>
  );
}
