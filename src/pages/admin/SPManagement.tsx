import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServiceProviders, useToggleSPStatus, useArchiveSP } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Eye, Pencil, Archive, Ban, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function SPManagement() {
  const [search, setSearch] = useState("");
  const { data: providers = [], isLoading } = useServiceProviders();
  const toggleStatus = useToggleSPStatus();
  const archiveMutation = useArchiveSP();

  // Load login linkage data
  const { data: loginMap = new Map() } = useQuery({
    queryKey: ["sp_login_map"],
    queryFn: async () => {
      const [rolesRes, authRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, sp_id, role").eq("role", "sp"),
        supabase.functions.invoke("create-user", { body: { action: "list-users" } }),
      ]);
      const roles = rolesRes.data ?? [];
      const authUsers: { id: string; email: string }[] = authRes.data?.users ?? [];
      const emailMap = new Map(authUsers.map((u) => [u.id, u.email]));

      const result = new Map<string, { email: string }>();
      for (const r of roles) {
        if (r.sp_id) {
          result.set(r.sp_id, { email: emailMap.get(r.user_id) ?? "" });
        }
      }
      return result;
    },
  });

  // Load availability summaries
  const { data: availMap = new Map() } = useQuery({
    queryKey: ["sp_availability_summary"],
    queryFn: async () => {
      const { data } = await supabase.from("sp_availability").select("sp_id, schedule_json, max_jobs_per_day");
      const result = new Map<string, string>();
      for (const row of data ?? []) {
        const sched = row.schedule_json as any[];
        if (Array.isArray(sched)) {
          const enabledDays = sched.filter((s: any) => s.enabled).map((s: any) => s.day?.slice(0, 3));
          const summary = enabledDays.length > 0
            ? `${enabledDays.join(", ")}, ${row.max_jobs_per_day}/day`
            : "No schedule";
          result.set(row.sp_id, summary);
        }
      }
      return result;
    },
  });

  const filtered = providers.filter(
    (sp) =>
      sp.status !== "Archived" &&
      (sp.name.toLowerCase().includes(search.toLowerCase()) ||
        sp.baseAddress.city.toLowerCase().includes(search.toLowerCase()) ||
        sp.serviceCategories.some((c) => c.toLowerCase().includes(search.toLowerCase())))
  );

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading providers...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Service Providers</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} providers</p>
        </div>
        <Link to="/admin/providers/new">
          <Button><Plus className="h-4 w-4 mr-2" />Add Service Provider</Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, city, category..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="metric-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-medium text-muted-foreground">Name</th>
              <th className="pb-3 font-medium text-muted-foreground">Status</th>
              <th className="pb-3 font-medium text-muted-foreground">Login</th>
              <th className="pb-3 font-medium text-muted-foreground">City</th>
              <th className="pb-3 font-medium text-muted-foreground">Categories</th>
              <th className="pb-3 font-medium text-muted-foreground">Availability</th>
              <th className="pb-3 font-medium text-muted-foreground">Rating</th>
              <th className="pb-3 font-medium text-muted-foreground">Compliance</th>
              <th className="pb-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sp) => {
              const login = loginMap.get(sp.id);
              const availSummary = availMap.get(sp.id);
              return (
                <tr key={sp.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                        {sp.avatar}
                      </div>
                      {sp.name}
                    </div>
                  </td>
                  <td className="py-3">
                    <StatusBadge label={sp.status} variant={sp.status === "Active" ? "valid" : "error"} />
                  </td>
                  <td className="py-3">
                    {login ? (
                      <div>
                        <p className="text-xs truncate max-w-[140px]">{login.email}</p>
                        <StatusBadge label="Enabled" variant="valid" />
                      </div>
                    ) : (
                      <StatusBadge label="Not Created" variant="warning" />
                    )}
                  </td>
                  <td className="py-3 text-muted-foreground">{sp.baseAddress.city}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {sp.serviceCategories.map((c) => (
                        <span key={c} className="status-badge bg-secondary text-secondary-foreground">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                    {availSummary || `${sp.maxJobsPerDay}/day, ${sp.travelRadius}km`}
                  </td>
                  <td className="py-3">⭐ {sp.rating}</td>
                  <td className="py-3">
                    <StatusBadge
                      label={sp.complianceStatus}
                      variant={sp.complianceStatus === "Valid" ? "valid" : sp.complianceStatus === "Expiring" ? "warning" : "error"}
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <Link to={`/admin/providers/${sp.id}`}>
                        <Button size="sm" variant="ghost" title="View"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <Link to={`/admin/providers/${sp.id}/edit`}>
                        <Button size="sm" variant="ghost" title="Edit"><Pencil className="h-4 w-4" /></Button>
                      </Link>
                      <Button
                        size="sm" variant="ghost"
                        title={sp.status === "Active" ? "Suspend" : "Unsuspend"}
                        onClick={() => toggleStatus.mutate({ id: sp.id, status: sp.status === "Active" ? "Suspended" : "Active" })}
                      >
                        {sp.status === "Active" ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" title="Archive" onClick={() => archiveMutation.mutate(sp.id)}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
