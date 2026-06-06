import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Pill, Package, BarChart3, ShieldCheck, ScanLine, FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PharmaCore — Pharmacy Inventory Management" },
      { name: "description", content: "All-in-one pharmacy inventory, billing, stock reconciliation and analytics. Built for accuracy and speed." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const features = [
    { icon: Package, title: "Inventory Integrity", desc: "Batch, expiry, MRP, GST — tracked at item level with audit trail." },
    { icon: BarChart3, title: "Sales & Profit Analytics", desc: "Daily closings, margin reports, top movers, payment splits." },
    { icon: ShieldCheck, title: "Stock Reconciliation", desc: "Physical counts vs system — instant difference reports." },
    { icon: ScanLine, title: "AI OCR Upload", desc: "Snap a medicine pack, auto-extract name, batch, expiry & MRP." },
    { icon: FileText, title: "GST Invoices & PDF", desc: "One-tap professional invoices, daily reports, exports." },
    { icon: Pill, title: "Alerts that matter", desc: "Low-stock & near-expiry warnings before they hurt revenue." },
  ];
  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-gradient-primary grid place-items-center shadow-elegant">
              <Pill className="size-5 text-primary-foreground" />
            </div>
            <span className="font-bold">PharmaCore</span>
          </Link>
          <Link to="/auth"><Button>Sign in</Button></Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-soft">
          <span className="size-1.5 rounded-full bg-success" /> Built for Indian pharmacies
        </div>
        <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight">
          Pharmacy operations,<br />
          <span className="bg-gradient-primary bg-clip-text text-transparent">precisely managed.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Inventory, billing, stock reconciliation, and reporting — engineered for accuracy and pharmacy-grade compliance.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link to="/auth"><Button size="lg" className="shadow-elegant">Get started</Button></Link>
          <Link to="/auth"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-24 grid md:grid-cols-3 gap-5">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6 shadow-soft hover:shadow-elegant transition-shadow">
            <div className="size-10 rounded-lg bg-accent grid place-items-center mb-4">
              <f.icon className="size-5 text-primary" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PharmaCore
      </footer>
    </div>
  );
}
