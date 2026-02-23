import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Copy, UserPlus, RotateCcw, Link, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

/** Canonical login existence check: user_roles row with role=sp, sp_id=this SP, user_id not null */
interface LinkedUserData {
  userId: string;
  email: string;
  role: string;
  roleRowFound: boolean;
  spIdOnRole: string | null;
}

interface Props {
  spId: string;
  spName: string;
}

export default function SPLoginAccess({ spId, spName }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Unified login linkage query — single source of truth
  const { data: linkage, isLoading, refetch } = useQuery({
    queryKey: ["sp_linked_user", spId],
    queryFn: async () => {
      // Get user_roles row for this sp_id with role=sp
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("user_id, role, sp_id")
        .eq("sp_id", spId)
        .eq("role", "sp")
        .maybeSingle();

      // Get all auth users for email resolution
      const { data: authData } = await supabase.functions.invoke("create-user", {
        body: { action: "list-users" },
      });
      const authUsers: { id: string; email: string }[] = authData?.users ?? [];

      if (!roleRow || !roleRow.user_id) {
        return {
          hasLogin: false,
          roleRowFound: !!roleRow,
          userId: roleRow?.user_id ?? null,
          spIdOnRole: roleRow?.sp_id ?? null,
          role: roleRow?.role ?? null,
          email: null,
          computedStatus: "Not Created" as const,
          authUsers,
        };
      }

      const authUser = authUsers.find((u) => u.id === roleRow.user_id);

      return {
        hasLogin: true,
        roleRowFound: true,
        userId: roleRow.user_id,
        spIdOnRole: roleRow.sp_id,
        role: roleRow.role,
        email: authUser?.email ?? "Unknown",
        computedStatus: "Enabled" as const,
        authUsers,
      };
    },
  });

  const hasLogin = linkage?.hasLogin ?? false;

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
      qc.invalidateQueries({ queryKey: ["sp_login_map"] });
      setCreatedCredentials({ email: createEmail, password: createPassword });
      toast({ title: "Login created", description: `Account created for ${spName}` });
    },
    onError: (err: any) => setCreateError(err.message),
  });

  // Link existing user state
  const [showLink, setShowLink] = useState(false);
  const [linkUserId, setLinkUserId] = useState("");

  // Load unlinked users
  const { data: unlinkableUsers } = useQuery({
    queryKey: ["unlinked_sp_users"],
    queryFn: async () => {
      const [authRes, rolesRes] = await Promise.all([
        supabase.functions.invoke("create-user", { body: { action: "list-users" } }),
        supabase.from("user_roles").select("*"),
      ]);
      const authUsers: { id: string; email: string }[] = authRes.data?.users ?? [];
      const roles = rolesRes.data ?? [];
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
      qc.invalidateQueries({ queryKey: ["sp_login_map"] });
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
      if (!hasLogin || !linkage?.userId) throw new Error("No login exists for this SP");
      const response = await supabase.functions.invoke("create-user", {
        body: { action: "reset-password", userId: linkage.userId, password: resetPassword },
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
    <div className="space-y-6 mt-4">
      {/* Status Card */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Login & Access</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Linked User Email</p>
            <p className="text-sm font-medium">{hasLogin ? linkage?.email : <span className="text-muted-foreground italic">Not created</span>}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Login Status</p>
            <StatusBadge
              label={linkage?.computedStatus ?? "Not Created"}
              variant={hasLogin ? "valid" : "warning"}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">User Role</p>
            <p className="text-sm font-medium">{hasLogin ? "Service Provider" : "—"}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="metric-card space-y-4">
        {hasLogin ? (
          <>
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
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold">Set Up Login</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreate(!showCreate); setShowLink(false); setCreatedCredentials(null); setCreateError(""); }}>
                <UserPlus className="h-4 w-4 mr-2" />Create Login
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowLink(!showLink); setShowCreate(false); }}>
                <Link className="h-4 w-4 mr-2" />Link Existing User
              </Button>
            </div>

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
                <p className="text-xs text-muted-foreground">⚠️ Save this password now; it won't be shown again.</p>
              </div>
            )}

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
          </>
        )}
      </div>

      {/* Admin Diagnostic Panel */}
      <DiagnosticPanel
        spId={spId}
        spName={spName}
        linkage={linkage}
        onRefresh={() => refetch()}
        onFixLinkage={(userId: string) => {
          linkUser.mutate(undefined, {
            onSuccess: () => refetch(),
          });
          // Use the direct fix approach
        }}
      />
    </div>
  );
}

/* ─── Diagnostic Panel (admin-only) ─── */

interface DiagnosticProps {
  spId: string;
  spName: string;
  linkage: any;
  onRefresh: () => void;
  onFixLinkage: (userId: string) => void;
}

function DiagnosticPanel({ spId, spName, linkage, onRefresh }: DiagnosticProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fixUserId, setFixUserId] = useState("");
  const [showFix, setShowFix] = useState(false);

  const fixLinkage = useMutation({
    mutationFn: async () => {
      if (!fixUserId) throw new Error("Select a user");
      const response = await supabase.functions.invoke("create-user", {
        body: { action: "update-role", userId: fixUserId, role: "sp", spId },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sp_linked_user", spId] });
      qc.invalidateQueries({ queryKey: ["sp_login_map"] });
      toast({ title: "Linkage fixed", description: "user_roles updated." });
      setShowFix(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const needsFix = linkage && !linkage.hasLogin;

  return (
    <div className="metric-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🔧 Diagnostic (Admin)</h3>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3 w-3 mr-1" />Refresh
        </Button>
      </div>

      <div className="grid gap-2 text-xs font-mono bg-muted/50 rounded-lg p-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">service_provider.id</span>
          <span className="truncate max-w-[200px]">{spId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">service_provider.name</span>
          <span>{spName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">user_roles row found?</span>
          <span className={linkage?.roleRowFound ? "text-green-600" : "text-destructive"}>
            {linkage?.roleRowFound ? "Yes" : "No"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">user_roles.user_id</span>
          <span className="truncate max-w-[200px]">{linkage?.userId ?? "(none)"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">user_roles.role</span>
          <span>{linkage?.role ?? "(none)"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">user_roles.sp_id</span>
          <span className="truncate max-w-[200px]">{linkage?.spIdOnRole ?? "(none)"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">resolved auth email</span>
          <span>{linkage?.email ?? "(none)"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">computed status</span>
          <StatusBadge
            label={linkage?.computedStatus ?? "Not Created"}
            variant={linkage?.hasLogin ? "valid" : "warning"}
          />
        </div>
      </div>

      {/* Fix Linkage actions */}
      {needsFix && (
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {linkage?.roleRowFound && !linkage?.userId
              ? "Role row exists but user_id is missing."
              : "No role row found for this SP."}
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowFix(!showFix)}>
            <Link className="h-3 w-3 mr-1" />Fix Linkage — Link User to this SP
          </Button>

          {showFix && (
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs">Select auth user to link</Label>
              <Select value={fixUserId} onValueChange={setFixUserId}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Select user..." /></SelectTrigger>
                <SelectContent>
                  {(linkage?.authUsers ?? []).map((u: { id: string; email: string }) => (
                    <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => fixLinkage.mutate()} disabled={fixLinkage.isPending || !fixUserId}>
                {fixLinkage.isPending ? "Fixing..." : "Save Linkage"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
