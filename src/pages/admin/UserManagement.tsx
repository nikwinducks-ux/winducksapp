import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, RotateCcw, Copy, Pencil, Link } from "lucide-react";

interface UserRow {
  userId: string;
  email: string;
  role: "admin" | "sp";
  spId: string | null;
  spName: string | null;
  createdAt: string;
}

interface SpOption {
  id: string;
  name: string;
  city: string;
}

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export default function UserManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Load SPs for dropdowns
  const { data: spOptions } = useQuery<SpOption[]>({
    queryKey: ["sp_options_for_users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select("id, name, base_address_city, status")
        .neq("status", "Archived");
      return (data ?? []).map((s) => ({ id: s.id, name: s.name, city: s.base_address_city }));
    },
  });

  // Load users with emails from edge function + roles + SP names
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      // Fetch auth users (emails) and roles in parallel
      const [authRes, rolesRes, spRes] = await Promise.all([
        supabase.functions.invoke("create-user", { body: { action: "list-users" } }),
        supabase.from("user_roles").select("*"),
        supabase.from("service_providers").select("id, name"),
      ]);

      const authUsers: { id: string; email: string; created_at: string }[] = authRes.data?.users ?? [];
      const emailMap = new Map(authUsers.map((u) => [u.id, u]));
      const spMap = new Map((spRes.data ?? []).map((s) => [s.id, s.name]));
      const roles = rolesRes.data ?? [];

      const results: UserRow[] = roles.map((r) => {
        const auth = emailMap.get(r.user_id);
        return {
          userId: r.user_id,
          email: auth?.email ?? "",
          role: r.role as "admin" | "sp",
          spId: r.sp_id,
          spName: r.sp_id ? spMap.get(r.sp_id) ?? "Unknown" : null,
          createdAt: auth?.created_at ?? "",
        };
      });

      return results;
    },
  });

  // --- Create User ---
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState(() => generatePassword());
  const [newRole, setNewRole] = useState<"admin" | "sp">("sp");
  const [newSpId, setNewSpId] = useState("");
  const [createError, setCreateError] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const createUser = useMutation({
    mutationFn: async () => {
      if (newRole === "sp" && !newSpId) throw new Error("SP users must be linked to a Service Provider.");
      const response = await supabase.functions.invoke("create-user", {
        body: { email: newEmail, password: newPassword, role: newRole, spId: newRole === "sp" ? newSpId : null },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_users"] });
      setCreatedCredentials({ email: newEmail, password: newPassword });
      toast({ title: "User created", description: `Account created for ${newEmail}` });
    },
    onError: (err: any) => setCreateError(err.message),
  });

  // --- Edit User ---
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "sp">("sp");
  const [editSpId, setEditSpId] = useState("");
  const [editError, setEditError] = useState("");

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditRole(u.role);
    setEditSpId(u.spId ?? "");
    setEditError("");
    setEditOpen(true);
  };

  const updateRole = useMutation({
    mutationFn: async () => {
      if (!editUser) throw new Error("No user selected");
      if (editRole === "sp" && !editSpId) throw new Error("SP users must be linked to a Service Provider.");
      const response = await supabase.functions.invoke("create-user", {
        body: { action: "update-role", userId: editUser.userId, role: editRole, spId: editRole === "sp" ? editSpId : null },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_users"] });
      toast({ title: "User updated", description: `Role updated for ${editUser?.email || editUser?.userId}` });
      setEditOpen(false);
    },
    onError: (err: any) => setEditError(err.message),
  });

  // --- Reset Password ---
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetPassword, setResetPassword] = useState(() => generatePassword());

  const resetPw = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("create-user", {
        body: { action: "reset-password", userId: resetUserId, password: resetPassword },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast({ title: "Password reset", description: "New password has been set." });
      setResetOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const spDropdown = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select SP..." /></SelectTrigger>
      <SelectContent>
        {(spOptions ?? []).map((sp) => (
          <SelectItem key={sp.id} value={sp.id}>{sp.name} — {sp.city}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">Manage platform user accounts</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setCreatedCredentials(null); setCreateError(""); setNewEmail(""); setNewPassword(generatePassword()); setNewSpId(""); } }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            {createdCredentials ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">User created successfully. Share these credentials:</p>
                <div className="metric-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm"><strong>Email:</strong> {createdCredentials.email}</span>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(createdCredentials.email)}><Copy className="h-3 w-3" /></Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm"><strong>Password:</strong> {createdCredentials.password}</span>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(createdCredentials.password)}><Copy className="h-3 w-3" /></Button>
                  </div>
                </div>
                <Button onClick={() => { setCreateOpen(false); setCreatedCredentials(null); }} className="w-full">Done</Button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setCreateError(""); createUser.mutate(); }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <div className="flex gap-2">
                    <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                    <Button type="button" variant="outline" size="sm" onClick={() => setNewPassword(generatePassword())}>Generate</Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={(v) => { setNewRole(v as "admin" | "sp"); if (v === "admin") setNewSpId(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="sp">Service Provider</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newRole === "sp" && (
                  <div className="space-y-1.5">
                    <Label>Link to Service Provider <span className="text-destructive">*</span></Label>
                    {spDropdown(newSpId, setNewSpId)}
                  </div>
                )}
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <Button type="submit" className="w-full" disabled={createUser.isPending}>
                  {createUser.isPending ? "Creating..." : "Create User"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Linked SP</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (users ?? []).map((u) => (
              <TableRow key={u.userId}>
                <TableCell className="font-mono text-xs">{u.userId.slice(0, 8)}…</TableCell>
                <TableCell className="text-sm">{u.email || <span className="text-muted-foreground italic">unknown</span>}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role === "admin" ? "Admin" : "SP"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.role === "admin" ? "—" : u.spName ? (
                    <span>{u.spName}</span>
                  ) : (
                    <span className="text-destructive text-sm flex items-center gap-1">
                      Not linked
                      <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => openEdit(u)}>
                        <Link className="h-3 w-3" />
                      </Button>
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                      <Pencil className="h-3 w-3 mr-1" />Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setResetUserId(u.userId); setResetPassword(generatePassword()); setResetOpen(true); }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />Reset
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditError(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          {editUser && (
            <form onSubmit={(e) => { e.preventDefault(); setEditError(""); updateRole.mutate(); }} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={editUser.email || editUser.userId} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={(v) => { setEditRole(v as "admin" | "sp"); if (v === "admin") setEditSpId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="sp">Service Provider</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editRole === "sp" && (
                <div className="space-y-1.5">
                  <Label>Link to Service Provider <span className="text-destructive">*</span></Label>
                  {spDropdown(editSpId, setEditSpId)}
                </div>
              )}
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <Button type="submit" className="w-full" disabled={updateRole.isPending}>
                {updateRole.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); resetPw.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <div className="flex gap-2">
                <Input value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required />
                <Button type="button" variant="outline" size="sm" onClick={() => setResetPassword(generatePassword())}>Generate</Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={resetPw.isPending}>
              {resetPw.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
