import { useState } from "react";
import { useJobs, useServiceProviders, useServiceCategories } from "@/hooks/useSupabaseData";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge, URGENCY_PRIORITY } from "@/components/UrgencyBadge";
import { JobServicesCodesSummary } from "@/components/JobServicesDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Eye, Pencil, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

export default function JobManagement() {
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const { data: jobs = [], isLoading } = useJobs();
  const { data: providers = [] } = useServiceProviders();
  const { data: categories = [] } = useServiceCategories();

  const spMap = new Map(providers.map((sp) => [sp.id, sp.name]));

  let filtered = jobs.filter(
    (j) =>
      j.status !== "Cancelled" &&
      (j.id.toLowerCase().includes(search.toLowerCase()) ||
        j.customerName.toLowerCase().includes(search.toLowerCase()) ||
        j.serviceCategory.toLowerCase().includes(search.toLowerCase()) ||
        j.jobAddress.city.toLowerCase().includes(search.toLowerCase()))
  );

  if (urgencyFilter !== "all") {
    filtered = filtered.filter((j) => (j.urgency || "Scheduled") === urgencyFilter);
  }
  if (statusFilter !== "all") {
    filtered = filtered.filter((j) => j.status === statusFilter);
  }

  if (sortBy === "urgency") {
    filtered = [...filtered].sort((a, b) => (URGENCY_PRIORITY[a.urgency || "Scheduled"] ?? 2) - (URGENCY_PRIORITY[b.urgency || "Scheduled"] ?? 2));
  } else if (sortBy === "scheduled") {
    filtered = [...filtered].sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
  }

  const statusVariant = (s: string) => {
    switch (s) {
      case "Assigned": case "Accepted": return "info";
      case "InProgress": return "warning";
      case "Completed": return "valid";
      case "Cancelled": case "Expired": return "warning";
      case "Created": case "Offered": return "neutral";
      default: return "neutral";
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "InProgress": return "In Progress";
      default: return s;
    }
  };

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading jobs...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} jobs</p>
        </div>
        <Link to="/admin/jobs/new">
          <Button><Plus className="h-4 w-4 mr-2" />Create Job</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search job #, customer, type, city..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Urgency" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Urgency</SelectItem>
            <SelectItem value="ASAP">ASAP</SelectItem>
            <SelectItem value="Anytime soon">Anytime soon</SelectItem>
            <SelectItem value="Scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Created">Created</SelectItem>
            <SelectItem value="Offered">Offered</SelectItem>
            <SelectItem value="Assigned">Assigned</SelectItem>
            <SelectItem value="InProgress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="urgency">Urgency Priority</SelectItem>
            <SelectItem value="scheduled">Scheduled Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="metric-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-medium text-muted-foreground">Job #</th>
              <th className="pb-3 font-medium text-muted-foreground">Customer</th>
              <th className="pb-3 font-medium text-muted-foreground">Service(s)</th>
              <th className="pb-3 font-medium text-muted-foreground">Amount</th>
              <th className="pb-3 font-medium text-muted-foreground">City</th>
              <th className="pb-3 font-medium text-muted-foreground">Urgency</th>
              <th className="pb-3 font-medium text-muted-foreground">Status</th>
              <th className="pb-3 font-medium text-muted-foreground">Assigned SP</th>
              <th className="pb-3 font-medium text-muted-foreground">Created</th>
              <th className="pb-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => (
              <tr key={job.id} className="border-b last:border-0">
                <td className="py-3 font-medium">{job.id}</td>
                <td className="py-3">{job.customerName}</td>
                <td className="py-3">
                  <JobServicesCodesSummary services={job.services} categories={categories} fallbackCategory={job.serviceCategory} />
                </td>
                <td className="py-3 font-medium">${job.payout}</td>
                <td className="py-3 text-muted-foreground">{job.jobAddress.city}</td>
                <td className="py-3">
                  <UrgencyBadge urgency={job.urgency} />
                </td>
                <td className="py-3">
                  <StatusBadge label={statusLabel(job.status)} variant={statusVariant(job.status) as any} />
                </td>
                <td className="py-3 text-muted-foreground">
                  {job.assignedSpId ? spMap.get(job.assignedSpId) ?? "—" : "—"}
                </td>
                <td className="py-3 text-muted-foreground">{job.scheduledDate}</td>
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    <Link to={`/admin/jobs/${job.dbId}`}>
                      <Button size="sm" variant="ghost" title="View"><Eye className="h-4 w-4" /></Button>
                    </Link>
                    <Link to={`/admin/jobs/${job.dbId}/edit`}>
                      <Button size="sm" variant="ghost" title="Edit"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Link to={`/admin/jobs/${job.dbId}?assign=true`}>
                      <Button size="sm" variant="ghost" title="Assign SP"><UserPlus className="h-4 w-4" /></Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
