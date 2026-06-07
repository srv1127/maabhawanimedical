import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Pill, LayoutDashboard, Package, ShoppingCart, FileText, ClipboardCheck, BarChart3, ScanLine, Users, LogOut, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const nav = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/inventory", icon: Package, label: "Inventory" },
  { to: "/app/sales", icon: ShoppingCart, label: "New Sale (POS)" },
  { to: "/app/bulk-import", icon: Sparkles, label: "Bulk AI Import" },
  { to: "/app/invoices", icon: FileText, label: "Invoices" },
  { to: "/app/stock-count", icon: ClipboardCheck, label: "Stock Count" },
  { to: "/app/reports", icon: BarChart3, label: "Reports" },
  { to: "/app/ocr", icon: ScanLine, label: "OCR Upload" },
  { to: "/app/users", icon: Users, label: "Users & Roles", adminOnly: true },
];

function AppLayout() {
  const { user, loading, signOut, roles, hasRole } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => { setOpen(false); }, [pathname]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const Sidebar = (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-4 flex items-center gap-2 border-b border-sidebar-border">
        <div className="size-9 rounded-lg bg-gradient-primary grid place-items-center">
          <Pill className="size-5 text-primary-foreground" />
        </div>
        <div>
          <div className="font-bold leading-tight">PharmaCore</div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">{roles[0] ?? "staff"}</div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {nav.filter((n) => !n.adminOnly || hasRole("admin")).map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "hover:bg-sidebar-accent")}>
              <item.icon className="size-4" />{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <div className="text-xs truncate text-sidebar-foreground/70 mb-2">{user.email}</div>
        <Button size="sm" variant="secondary" className="w-full" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
          <LogOut className="size-4 mr-2" /> Sign out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-50 flex">{Sidebar}</div>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden border-b bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setOpen(true)}><Menu /></button>
          <div className="font-bold">PharmaCore</div>
          <div className="w-6" />
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto"><Outlet /></main>
      </div>
    </div>
  );
}
