import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useEstimates, useCreateEstimate, useDuplicateEstimate, useArchiveEstimate } from "@/hooks/useEstimates";
import { useCustomers } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCAD } from "@/lib/currency";
import { FileSignature, Search, Plus, Copy, Archive, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "valid" | "warning" | "error"> = {
  Draft: "neutral", Sent: "info", Viewed: "info",
  Accepted: "valid", Declined: "error", Expired: "warning",
  Converted: "valid", Archived: "neutral",
};

export default function EstimatesList() {
  const { data: estimates = [], isLoading } = useEstimates();
  const { data: customers = [] } = useCustomers();
  const create = useCreateEstimate();
  const duplicate = useDuplicateEstimate();
  const archive = useArchiveEstimate();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const customerById = useMemo(() => {
    const m = new Map<string, string>();
    customers.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    return estimates.filter((e) => {
      if (statusFilter !== "All" && e.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const cn = e.customer_id ? (customerById.get(e.customer_id) || "") : "";
        return e.estimate_number.toLowerCase().includes(q) || cn.toLowerCase().includes(q);
      }
      return true;
    });
  }, [estimates, statusFilter, search, customerById]);

  const totals = useMemo(() => {
    const t = { total: 0, outstanding: 0, accepted: 0, converted: 0 };
    estimates.forEach((e) => {
      const v = Number(e.accepted_total ?? 0);
      if (e.status === "Sent" || e.status === "Viewed") t.outstanding += 1;
      if (e.status === "Accepted") { t.accepted += 1; t.total += v; }
      if (e.status === "Converted") t.converted += 1;
    });
    return t;
  }, [estimates]);

  const handleCreate = async () => {
    const r = await create.mutateAsync({});
    navigate(`/admin/estimates/${r.id}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Estimates</h1>
          <p className="text-sm text-muted-foreground">Quotes, proposals, and customer-approved estimates.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/discount-codes">
            <Button variant="outline" size="sm"><Tag className="h-4 w-4 mr-1" />Discount codes</Button>
          </Link>
          <Link to="/admin/products">
            <Button variant="outline" size="sm">Products</Button>
          </Link>
          <Button onClick={handleCreate} disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-1" />New estimate
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">All</p>
          <p className="text-2xl font-bold">{estimates.length}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold text-info">{totals.outstanding}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Accepted value</p>
          <p className="text-2xl font-bold text-success">{formatCAD(totals.total)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Converted</p>
          <p className="text-2xl font-bold">{totals.converted}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search # or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["All", "Draft", "Sent", "Viewed", "Accepted", "Declined", "Expired", "Converted", "Archived"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="metric-card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileSignature className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No estimates found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium">Estimate #</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="text-left p-3 font-medium">Expires</th>
                  <th className="text-left p-3 font-medium">Job</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{e.estimate_number}</td>
                    <td className="p-3">{e.customer_id ? customerById.get(e.customer_id) || "—" : "—"}</td>
                    <td className="p-3">
                      <StatusBadge label={e.status} variant={STATUS_VARIANT[e.status] || "neutral"} />
                    </td>
                    <td className="p-3 text-right font-medium">
                      {e.accepted_total != null ? formatCAD(e.accepted_total) : "—"}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-xs text-muted-foreground">{e.expires_at ? new Date(e.expires_at).toLocaleDateString() : "—"}</td>
                    <td className="p-3 text-xs">
                      {e.converted_job_id ? (
                        <Link to={`/admin/jobs/${e.converted_job_id}`} className="text-primary hover:underline">View job</Link>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Link to={`/admin/estimates/${e.id}`}>
                        <Button size="sm" variant="outline">Open</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => duplicate.mutate(e.id)} title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {e.status !== "Archived" && e.status !== "Converted" && (
                        <Button size="sm" variant="ghost" onClick={() => archive.mutate(e.id)} title="Archive">
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
