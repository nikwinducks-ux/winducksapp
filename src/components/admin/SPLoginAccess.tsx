import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Copy, UserPlus, RotateCcw, Link, Unlink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

interface Props {
  spId: string;
  spName: string;
}

export default function SPLoginAccess({ spId, spName }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Load linked user for this SP
  const { data: linkedUser, isLoading } = useQuery({
    queryKey: ["sp_linked_user", spId],
    queryFn: async () => {
      // Get user_roles row for this sp_id
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("user_id, role, sp_id")
        .eq("sp_id", spId)
        .eq("role", "sp")
        .maybeSingle();

      if (!roleRow) return null;

      // Get auth user email
      const { data: authData } = await supabase.functions.invoke("create-user", {
        body: { action: "list-users" },
      });
      const authUsers: { id: string; email: string }[] = authData?.users ?? [];
      const authUser = authUsers.find((u) => u.id === roleRow.user_id);

      return {
        userId: roleRow.user_id,
        email: authUser?.email ?? "Unknown",
        role: roleRow.role as string,
      };
    },
  });

  // Create login state
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState(() => generatePassword());
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [createError, setCreateError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const createLogin = useMutation({
    mutationFn: async () => {
      if (!createEmail) throw new Error("Email is required");
      const response = await supabase.functions.invoke("create-user", {
        body: { email: createEmail, password: createPassword, role: "sp", spId },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sp_linked_user", spId] });
      qc.invalidateQueries({ queryKey: ["admin_users"] });
      setCreatedCredentials({ email: createEmail, password: createPassword });
      toast({ title: "Login created", description: `Account created for ${spName}` });
    },
    onError: (err: any) => setCreateError(err.message),
  });

  // Link existing user state
  const [showLink, setShowLink] = useState(false);
  const [linkUserId, setLinkUserId] = useState("");

  // Load unlinked SP users
  const { data: unlinkableUsers } = useQuery({
    queryKey: ["unlinked_sp_users"],
    queryFn: async () => {
      const [authRes, rolesRes] = await Promise.all([
        supabase.functions.invoke("create-user", { body: { action: "list-users" } }),
        supabase.from("user_roles").select("*"),
      ]);
      const authUsers: { id: string; email: string }[] = authRes.data?.users ?? [];
      const roles = rolesRes.data ?? [];

      // Users with no role or sp role with no sp_id
      const usersWithRoles = new Map(roles.map((r) => [r.user_id, r]));
      const candidates: { id: string; email: string }[] = [];
      for (const au of authUsers) {
        const role = usersWithRoles.get(au.id);
        if (!role || (role.role === "sp" && !role.sp_id)) {
          candidates.push({ id: au.id, email: au.email });
        }
      }
      return candidates;
    },
    enabled: showLink,
  });

  const linkUser = useMutation({
    mutationFn: async () => {
      if (!linkUserId) throw new Error("Select a user");
      const response = await supabase.functions.invoke("create-user", {
        body: { action: "update-role", userId: linkUserId, role: "sp", spId },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sp_linked_user", spId] });
      qc.invalidateQueries({ queryKey: ["admin_users"] });
      toast({ title: "User linked", description: `User linked to ${spName}` });
      setShowLink(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Reset password
  const [showReset, setShowReset] = useState(false);
  const [resetPassword, setResetPassword] = useState(() => generatePassword());

  const resetPw = useMutation({
    mutationFn: async () => {
      if (!linkedUser) throw new Error("No linked user");
      const response = await supabase.functions.invoke("create-user", {
        body: { action: "reset-password", userId: linkedUser.userId, password: resetPassword },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast({ title: "Password reset", description: "New password has been set." });
      setShowReset(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading login info...</div>;

  return (
    <div className="metric-card space-y-6 mt-4">
      <h2 className="section-title">Login & Access</h2>

      {/* Current linked status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Linked User Email</p>
          <p className="text-sm font-medium">{linkedUser?.email ?? <span className="text-muted-foreground italic">Not created</span>}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Login Status</p>
          <StatusBadge
            label={linkedUser ? "Enabled" : "Not Created"}
            variant={linkedUser ? "valid" : "warning"}
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">User Role</p>
          <p className="text-sm font-medium">{linkedUser ? "Service Provider" : "—"}</p>
        </div>
      </div>

      {/* Actions */}
      {linkedUser ? (
        <div className="border-t pt-4 space-y-4">
          <h3 className="text-sm font-semibold">Account Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setResetPassword(generatePassword()); setShowReset(!showReset); }}>
              <RotateCcw className="h-4 w-4 mr-2" />Reset Password
            </Button>
          </div>

          {showReset && (
            <div className="rounded-lg border p-4 space-y-3">
              <Label>New Password</Label>
              <div className="flex gap-2">
                <Input value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={() => setResetPassword(generatePassword())}>Generate</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => copyToClipboard(resetPassword)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <Button size="sm" onClick={() => resetPw.mutate()} disabled={resetPw.isPending}>
                {resetPw.isPending ? "Resetting..." : "Confirm Reset"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="border-t pt-4 space-y-4">
          <h3 className="text-sm font-semibold">Set Up Login</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(!showCreate); setShowLink(false); setCreatedCredentials(null); setCreateError(""); }}>
              <UserPlus className="h-4 w-4 mr-2" />Create Login
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowLink(!showLink); setShowCreate(false); }}>
              <Link className="h-4 w-4 mr-2" />Link Existing User
            </Button>
          </div>

          {/* Create login form */}
          {showCreate && !createdCredentials && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="sp@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} />
                  <Button type="button" variant="outline" size="sm" onClick={() => setCreatePassword(generatePassword())}>Generate</Button>
                </div>
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <Button size="sm" onClick={() => { setCreateError(""); createLogin.mutate(); }} disabled={createLogin.isPending}>
                {createLogin.isPending ? "Creating..." : "Create Account"}
              </Button>
            </div>
          )}

          {/* Created credentials display */}
          {createdCredentials && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <p className="text-sm font-medium">Account created! Share these credentials:</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm"><strong>Email:</strong> {createdCredentials.email}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(createdCredentials.email)}><Copy className="h-3 w-3" /></Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm"><strong>Password:</strong> {createdCredentials.password}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(createdCredentials.password)}><Copy className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
          )}

          {/* Link existing user */}
          {showLink && (
            <div className="rounded-lg border p-4 space-y-3">
              <Label>Select User to Link</Label>
              <Select value={linkUserId} onValueChange={setLinkUserId}>
                <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
                <SelectContent>
                  {(unlinkableUsers ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(unlinkableUsers ?? []).length === 0 && <p className="text-xs text-muted-foreground">No unlinked users available.</p>}
              <Button size="sm" onClick={() => linkUser.mutate()} disabled={linkUser.isPending || !linkUserId}>
                {linkUser.isPending ? "Linking..." : "Link User"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
