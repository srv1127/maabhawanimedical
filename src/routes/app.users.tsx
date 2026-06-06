import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/users")({
  head: () => ({ meta: [{ title: "Users — PharmaCore" }] }),
  component: Users,
});

function Users() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, created_at");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => ({ ...p, roles: roles?.filter((r) => r.user_id === p.id).map((r) => r.role) ?? [] }));
    },
  });

  if (!hasRole("admin")) return <div className="text-muted-foreground">Admins only.</div>;

  const setRole = async (uid: string, role: "admin" | "pharmacist" | "cashier") => {
    await supabase.from("user_roles").delete().eq("user_id", uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["users-list"] });
  };

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Users & Roles</h1><p className="text-sm text-muted-foreground">Assign roles to staff members.</p></div>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Change</TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name ?? "—"}</TableCell>
                <TableCell className="text-xs">{u.email}</TableCell>
                <TableCell>{u.roles.map((r: string) => <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>)}</TableCell>
                <TableCell>
                  <Select onValueChange={(v: any) => setRole(u.id, v)}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Set role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="pharmacist">Pharmacist</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
