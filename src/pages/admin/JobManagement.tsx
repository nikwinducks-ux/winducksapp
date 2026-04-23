import { useMemo, useState } from "react";
import { useJobs, useServiceProviders, useServiceCategories, useDeleteJob, useStopBroadcast, useAssignJob, useUnassignJob } from "@/hooks/useSupabaseData";
import { useGenerateBroadcastOffers } from "@/hooks/useOfferData";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge, URGENCY_PRIORITY } from "@/components/UrgencyBadge";
import { JobServicesCodesSummary } from "@/components/JobServicesDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Eye, Pencil, UserPlus, UserX, Trash2, Radio, X, RadioTower } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const NON_BROADCASTABLE = new Set(["Assigned", "InProgress", "Completed", "Cancelled", "Archived"]);
const NON_ASSIGNABLE = new Set(["InProgress", "Completed", "Cancelled", "Archived"]);
const HAS_SP_STATUSES = new Set(["Assigned", "Accepted"]);

export default function JobManagement() {
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastRadius, setBroadcastRadius] = useState(100);
  const [broadcastNote, setBroadcastNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Single-job broadcast toggle state
  const [startBroadcastJobId, setStartBroadcastJobId] = useState<string | null>(null);
  const [stopBroadcastJobId, setStopBroadcastJobId] = useState<string | null>(null);
  const [bulkStopOpen, setBulkStopOpen] = useState(false);

  // Assign / Unassign state
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignSpId, setBulkAssignSpId] = useState<string>("");
  const [bulkUnassignOpen, setBulkUnassignOpen] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<{ jobDbId: string; jobNumber: string; spName: string } | null>(null);

  const { data: jobs = [], isLoading } = useJobs();
  const { data: providers = [] } = useServiceProviders();
  const { data: categories = [] } = useServiceCategories();
  const deleteJob = useDeleteJob();
  const stopBroadcast = useStopBroadcast();
  const broadcast = useGenerateBroadcastOffers();
  const assignJob = useAssignJob();
  const unassignJob = useUnassignJob();
  const { toast } = useToast();

  const spMap = new Map(providers.map((sp) => [sp.id, sp.name]));
  const activeSps = useMemo(
    () => providers.filter((sp) => sp.status === "Active").sort((a, b) => a.name.localeCompare(b.name)),
    [providers]
  );

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

  const visibleIds = useMemo(() => filtered.map((j) => j.dbId), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) visibleIds.forEach((id) => next.add(id));
      else visibleIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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

  const statusLabel = (s: string) => s === "InProgress" ? "In Progress" : s;

  const openDeleteSingle = (jobDbId: string) => {
    setDeleteTarget([jobDbId]);
    setDeleteConfirmText("");
    setDeleteOpen(true);
  };

  const openDeleteBulk = () => {
    setDeleteTarget(Array.from(selectedIds));
    setDeleteConfirmText("");
    setDeleteOpen(true);
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const id of deleteTarget) {
      try {
        await deleteJob.mutateAsync(id);
        ok++;
      } catch {
        fail++;
      }
    }
    if (deleteTarget.length > 1) {
      try {
        await supabase.from("admin_audit_logs").insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          user_email: (await supabase.auth.getUser()).data.user?.email ?? "",
          action: "bulk_delete_jobs",
          details: { job_ids: deleteTarget, count: deleteTarget.length, ok, fail },
        } as any);
      } catch { /* audit best-effort */ }
    }
    setBusy(false);
    setDeleteOpen(false);
    setDeleteTarget(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deleteTarget.forEach((id) => next.delete(id));
      return next;
    });
    toast({
      title: fail === 0 ? "Jobs deleted" : "Partial delete",
      description: `${ok} deleted${fail ? `, ${fail} failed` : ""}.`,
      variant: fail === 0 ? "default" : "destructive",
    });
  };

  const runBroadcast = async () => {
    // If single-job mode, only that job; else use selection
    const sourceIds = startBroadcastJobId ? [startBroadcastJobId] : Array.from(selectedIds);
    const targets = jobs.filter((j) => sourceIds.includes(j.dbId) && !NON_BROADCASTABLE.has(j.status));
    const skipped = sourceIds.length - targets.length;
    if (targets.length === 0) {
      toast({ title: "Nothing to broadcast", description: "Selected jobs are all in non-broadcastable statuses.", variant: "destructive" });
      return;
    }
    setBusy(true);
    let ok = 0;
    let fail = 0;
    let lastError = "";
    for (const job of targets) {
      try {
        const jobWithRadius = { ...job, broadcastRadiusKm: broadcastRadius, broadcastNote } as any;
        await broadcast.mutateAsync({ job: jobWithRadius, serviceProviders: providers });
        ok++;
      } catch (e: any) {
        fail++;
        lastError = e?.message ?? String(e);
      }
    }
    try {
      await supabase.from("admin_audit_logs").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        user_email: (await supabase.auth.getUser()).data.user?.email ?? "",
        action: startBroadcastJobId ? "start_broadcast" : "bulk_broadcast_jobs",
        details: {
          job_ids: targets.map((t) => t.dbId),
          count: targets.length,
          radius_km: broadcastRadius,
          note: broadcastNote,
          skipped,
          ok,
          fail,
          last_error: lastError,
        },
      } as any);
    } catch { /* best-effort */ }
    setBusy(false);
    setBroadcastOpen(false);
    setBroadcastNote("");
    setStartBroadcastJobId(null);
    if (!startBroadcastJobId) clearSelection();
    if (fail > 0 && ok === 0) {
      toast({
        title: "Broadcast failed",
        description: lastError || "The job broadcast status could not be saved. The toggle will remain Off.",
        variant: "destructive",
      });
    } else if (fail > 0) {
      toast({
        title: "Broadcast partially complete",
        description: `${ok} ok, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}. ${lastError}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Broadcast complete",
        description: `${ok} broadcast${skipped ? `, ${skipped} skipped` : ""}.`,
      });
    }
  };

  const openStartBroadcast = (job: any) => {
    setStartBroadcastJobId(job.dbId);
    setBroadcastRadius(job.broadcastRadiusKm || 100);
    setBroadcastNote(job.broadcastNote || "");
    setBroadcastOpen(true);
  };

  const runStopBroadcastSingle = async () => {
    if (!stopBroadcastJobId) return;
    setBusy(true);
    try {
      const result = await stopBroadcast.mutateAsync(stopBroadcastJobId);
      try {
        await supabase.from("admin_audit_logs").insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          user_email: (await supabase.auth.getUser()).data.user?.email ?? "",
          action: "stop_broadcast",
          details: { job_id: stopBroadcastJobId, cancelled_offer_count: (result as any)?.cancelled_offer_count ?? 0 },
        } as any);
      } catch { /* best-effort */ }
      toast({ title: "Broadcast stopped", description: `${(result as any)?.cancelled_offer_count ?? 0} pending offer(s) cancelled.` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
    setBusy(false);
    setStopBroadcastJobId(null);
  };

  const runBulkStopBroadcast = async () => {
    const targets = jobs.filter((j) => selectedIds.has(j.dbId) && j.isBroadcast);
    const skipped = selectedIds.size - targets.length;
    if (targets.length === 0) {
      toast({ title: "Nothing to stop", description: "No selected jobs are currently broadcasting.", variant: "destructive" });
      setBulkStopOpen(false);
      return;
    }
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const job of targets) {
      try {
        await stopBroadcast.mutateAsync(job.dbId);
        ok++;
      } catch {
        fail++;
      }
    }
    try {
      await supabase.from("admin_audit_logs").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        user_email: (await supabase.auth.getUser()).data.user?.email ?? "",
        action: "bulk_stop_broadcast",
        details: { job_ids: targets.map((t) => t.dbId), count: targets.length, ok, fail, skipped },
      } as any);
    } catch { /* best-effort */ }
    setBusy(false);
    setBulkStopOpen(false);
    clearSelection();
    toast({
      title: "Bulk stop complete",
      description: `${ok} stopped${fail ? `, ${fail} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}.`,
    });
  };

  // Assign single (row-level)
  const runAssignSingle = async (jobDbId: string, spId: string) => {
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    try {
      await assignJob.mutateAsync({ jobId: jobDbId, spId, assignedByUserId: userId });
    } catch { /* toast handled in hook */ }
  };

  // Unassign single (row-level)
  const runUnassignSingle = async () => {
    if (!unassignTarget) return;
    setBusy(true);
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    try {
      await unassignJob.mutateAsync({ jobDbId: unassignTarget.jobDbId, userId });
    } catch { /* hook toasts */ }
    setBusy(false);
    setUnassignTarget(null);
  };

  // Bulk assign
  const runBulkAssign = async () => {
    if (!bulkAssignSpId) return;
    const targets = jobs.filter((j) => selectedIds.has(j.dbId) && !NON_ASSIGNABLE.has(j.status));
    const skipped = selectedIds.size - targets.length;
    if (targets.length === 0) {
      toast({ title: "Nothing to assign", description: "Selected jobs are all in non-assignable statuses.", variant: "destructive" });
      setBulkAssignOpen(false);
      return;
    }
    setBusy(true);
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    let ok = 0, fail = 0;
    for (const job of targets) {
      try {
        await assignJob.mutateAsync({ jobId: job.dbId, spId: bulkAssignSpId, assignedByUserId: userId });
        ok++;
      } catch { fail++; }
    }
    try {
      await supabase.from("admin_audit_logs").insert({
        user_id: userId,
        user_email: (await supabase.auth.getUser()).data.user?.email ?? "",
        action: "bulk_assign_jobs",
        details: { job_ids: targets.map((t) => t.dbId), sp_id: bulkAssignSpId, count: targets.length, ok, fail, skipped },
      } as any);
    } catch { /* best-effort */ }
    setBusy(false);
    setBulkAssignOpen(false);
    setBulkAssignSpId("");
    clearSelection();
    toast({
      title: "Bulk assign complete",
      description: `${ok} assigned${fail ? `, ${fail} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}.`,
      variant: fail > 0 ? "destructive" : "default",
    });
  };

  // Bulk unassign
  const runBulkUnassign = async () => {
    const targets = jobs.filter((j) => selectedIds.has(j.dbId) && j.assignedSpId && HAS_SP_STATUSES.has(j.status));
    const skipped = selectedIds.size - targets.length;
    if (targets.length === 0) {
      toast({ title: "Nothing to unassign", description: "No selected jobs are currently assigned.", variant: "destructive" });
      setBulkUnassignOpen(false);
      return;
    }
    setBusy(true);
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    let ok = 0, fail = 0;
    for (const job of targets) {
      try {
        await unassignJob.mutateAsync({ jobDbId: job.dbId, userId });
        ok++;
      } catch { fail++; }
    }
    try {
      await supabase.from("admin_audit_logs").insert({
        user_id: userId,
        user_email: (await supabase.auth.getUser()).data.user?.email ?? "",
        action: "bulk_unassign_jobs",
        details: { job_ids: targets.map((t) => t.dbId), count: targets.length, ok, fail, skipped },
      } as any);
    } catch { /* best-effort */ }
    setBusy(false);
    setBulkUnassignOpen(false);
    clearSelection();
    toast({
      title: "Bulk unassign complete",
      description: `${ok} unassigned${fail ? `, ${fail} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}.`,
      variant: fail > 0 ? "destructive" : "default",
    });
  };

  const requireTypeConfirm = deleteCount > 1;
  const canConfirmDelete = !busy && (!requireTypeConfirm || deleteConfirmText === "DELETE");

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

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="h-4 w-4 mr-1" />Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setStartBroadcastJobId(null); setBroadcastOpen(true); }}>
              <Radio className="h-4 w-4 mr-2" />Broadcast Selected
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkStopOpen(true)}>
              <RadioTower className="h-4 w-4 mr-2" />Stop Broadcast
            </Button>
            <Button size="sm" variant="destructive" onClick={openDeleteBulk}>
              <Trash2 className="h-4 w-4 mr-2" />Delete Selected
            </Button>
          </div>
        </div>
      )}

      <div className="metric-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 pr-2 w-8">
                <Checkbox
                  checked={allVisibleSelected ? true : (someVisibleSelected ? "indeterminate" : false)}
                  onCheckedChange={(v) => toggleAllVisible(!!v)}
                  aria-label="Select all visible jobs"
                />
              </th>
              <th className="pb-3 font-medium text-muted-foreground">Job #</th>
              <th className="pb-3 font-medium text-muted-foreground">Customer</th>
              <th className="pb-3 font-medium text-muted-foreground">Service(s)</th>
              <th className="pb-3 font-medium text-muted-foreground">Amount</th>
              <th className="pb-3 font-medium text-muted-foreground">City</th>
              <th className="pb-3 font-medium text-muted-foreground">Urgency</th>
              <th className="pb-3 font-medium text-muted-foreground">Status</th>
              <th className="pb-3 font-medium text-muted-foreground">Broadcast</th>
              <th className="pb-3 font-medium text-muted-foreground">Assigned SP</th>
              <th className="pb-3 font-medium text-muted-foreground">Created</th>
              <th className="pb-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => {
              const checked = selectedIds.has(job.dbId);
              return (
                <tr key={job.id} className={`border-b last:border-0 ${checked ? "bg-primary/5" : ""}`}>
                  <td className="py-3 pr-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleOne(job.dbId, !!v)}
                      aria-label={`Select ${job.id}`}
                    />
                  </td>
                  <td className="py-3 font-medium">{job.id}</td>
                  <td className="py-3">{job.customerName}</td>
                  <td className="py-3">
                    <JobServicesCodesSummary services={job.services} categories={categories} fallbackCategory={job.serviceCategory} />
                  </td>
                  <td className="py-3 font-medium">${job.payout}</td>
                  <td className="py-3 text-muted-foreground">{job.jobAddress.city}</td>
                  <td className="py-3"><UrgencyBadge urgency={job.urgency} /></td>
                  <td className="py-3">
                    <StatusBadge label={statusLabel(job.status)} variant={statusVariant(job.status) as any} />
                  </td>
                  <td className="py-3">
                    {NON_BROADCASTABLE.has(job.status) ? (
                      <Badge variant="outline" className="text-muted-foreground">N/A</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!job.isBroadcast}
                          onCheckedChange={(v) => {
                            if (v) openStartBroadcast(job);
                            else setStopBroadcastJobId(job.dbId);
                          }}
                          aria-label="Toggle broadcast"
                        />
                        {job.isBroadcast ? (
                          <span className="text-xs text-muted-foreground">On · {job.broadcastRadiusKm || 100}km</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Off</span>
                        )}
                      </div>
                    )}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Delete"
                        onClick={() => openDeleteSingle(job.dbId)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => { if (!busy) setDeleteOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteCount} job{deleteCount === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the job{deleteCount === 1 ? "" : "s"}, their services, photos, offers, assignments, and history.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {requireTypeConfirm && (
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type <span className="font-mono font-semibold">DELETE</span> to confirm</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (canConfirmDelete) runDelete(); }}
              disabled={!canConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : `Delete ${deleteCount}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Broadcast dialog (single or bulk) */}
      <Dialog open={broadcastOpen} onOpenChange={(o) => { if (!busy) { setBroadcastOpen(o); if (!o) setStartBroadcastJobId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {startBroadcastJobId
                ? "Start broadcast"
                : `Broadcast ${selectedIds.size} job${selectedIds.size === 1 ? "" : "s"}`}
            </DialogTitle>
            <DialogDescription>
              Sends offers to all eligible Service Providers. Jobs already Assigned, In Progress, Completed, or Cancelled are skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="broadcast-radius">Broadcast radius (km)</Label>
              <Input
                id="broadcast-radius"
                type="number"
                min={1}
                max={100}
                value={broadcastRadius}
                onChange={(e) => setBroadcastRadius(Math.min(100, Math.max(1, Number(e.target.value) || 100)))}
              />
              <p className="text-xs text-muted-foreground">Max 100 km (system limit).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="broadcast-note">Note to providers (optional)</Label>
              <Textarea
                id="broadcast-note"
                value={broadcastNote}
                onChange={(e) => setBroadcastNote(e.target.value)}
                placeholder="e.g. Bundled job — please respond within 30 min."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBroadcastOpen(false); setStartBroadcastJobId(null); }} disabled={busy}>Cancel</Button>
            <Button onClick={runBroadcast} disabled={busy}>
              <Radio className="h-4 w-4 mr-2" />
              {busy ? "Broadcasting…" : (startBroadcastJobId ? "Broadcast" : `Broadcast ${selectedIds.size}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop broadcast (single) */}
      <AlertDialog open={!!stopBroadcastJobId} onOpenChange={(o) => { if (!busy && !o) setStopBroadcastJobId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels all pending offers for this job. If the job was Offered (not yet accepted), it returns to Created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runStopBroadcastSingle(); }}
              disabled={busy}
            >
              {busy ? "Stopping…" : "Stop broadcast"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stop broadcast (bulk) */}
      <AlertDialog open={bulkStopOpen} onOpenChange={(o) => { if (!busy) setBulkStopOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop broadcast for selected jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancels all pending offers for selected jobs currently broadcasting. Jobs not currently broadcasting are skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runBulkStopBroadcast(); }}
              disabled={busy}
            >
              {busy ? "Stopping…" : "Stop broadcast"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
