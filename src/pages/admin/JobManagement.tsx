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
import { Search, Plus, Eye, Pencil, UserPlus, UserX, Trash2, Radio, X, RadioTower, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ScheduleDebugBadge,
  ScheduleDebugToggle,
  isScheduleDebugEnabled,
  setScheduleDebugEnabled,
} from "@/components/calendar/ScheduleDebug";

const NON_BROADCASTABLE = new Set(["Assigned", "InProgress", "Completed", "Cancelled", "Archived"]);
const NON_ASSIGNABLE = new Set(["InProgress", "Completed", "Cancelled", "Archived"]);
const HAS_SP_STATUSES = new Set(["Assigned", "Accepted"]);
const NON_SCHEDULABLE = new Set(["Completed", "Cancelled", "Archived"]);

// 15-min increments, formatted 12h
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const value = `${hh}:${mm}`;
      const period = h < 12 ? "AM" : "PM";
      const h12 = ((h + 11) % 12) + 1;
      out.push({ value, label: `${h12}:${mm} ${period}` });
    }
  }
  return out;
})();

function formatScheduleToast(date: string, time: string) {
  try {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
    const dateStr = dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const timeLabel = TIME_OPTIONS.find((t) => t.value === time)?.label ?? time;
    return `${dateStr} · ${timeLabel}`;
  } catch {
    return `${date} ${time}`;
  }
}

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

  // Schedule dialog state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"single" | "bulk">("single");
  const [scheduleTarget, setScheduleTarget] = useState<{ jobDbId: string; jobNumber: string; customerName: string; scheduledDate?: string; scheduledTime?: string } | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleError, setScheduleError] = useState("");

  // Debug panel
  const [debug, setDebug] = useState(() => isScheduleDebugEnabled());
  function toggleDebug(next: boolean) {
    setDebug(next);
    setScheduleDebugEnabled(next);
  }
  const { data: jobs = [], isLoading } = useJobs();
  const { data: providers = [] } = useServiceProviders();
  const { data: categories = [] } = useServiceCategories();
  const deleteJob = useDeleteJob();
  const stopBroadcast = useStopBroadcast();
  const broadcast = useGenerateBroadcastOffers();
  const assignJob = useAssignJob();
  const unassignJob = useUnassignJob();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Schedule handlers
  const openScheduleSingle = (job: any) => {
    setScheduleMode("single");
    setScheduleTarget({
      jobDbId: job.dbId,
      jobNumber: job.id,
      customerName: job.customerName,
      scheduledDate: job.scheduledDate,
      scheduledTime: job.scheduledTime,
    });
    const usePrefill = (job.urgency || "Scheduled") === "Scheduled";
    setScheduleDate(usePrefill ? (job.scheduledDate || "") : "");
    setScheduleTime(usePrefill ? (job.scheduledTime || "") : "");
    setScheduleError("");
    setScheduleOpen(true);
  };

  const openScheduleBulk = () => {
    setScheduleMode("bulk");
    setScheduleTarget(null);
    setScheduleDate("");
    setScheduleTime("");
    setScheduleError("");
    setScheduleOpen(true);
  };

  const runScheduleSave = async () => {
    if (!scheduleDate || !scheduleTime) {
      setScheduleError("Please pick both a date and a time.");
      return;
    }
    setBusy(true);
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const userEmail = (await supabase.auth.getUser()).data.user?.email ?? "";

    if (scheduleMode === "single" && scheduleTarget) {
      try {
        const { error } = await supabase
          .from("jobs")
          .update({ scheduled_date: scheduleDate, scheduled_time: scheduleTime, urgency: "Scheduled" })
          .eq("id", scheduleTarget.jobDbId);
        if (error) throw error;
        try {
          await supabase.from("admin_audit_logs").insert({
            user_id: userId, user_email: userEmail,
            action: "job.schedule",
            details: {
              jobDbId: scheduleTarget.jobDbId,
              jobNumber: scheduleTarget.jobNumber,
              scheduledDate: scheduleDate,
              scheduledTime: scheduleTime,
              previousDate: scheduleTarget.scheduledDate ?? null,
              previousTime: scheduleTarget.scheduledTime ?? null,
            },
          } as any);
        } catch { /* best-effort */ }
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
        toast({ title: "Job scheduled", description: `Scheduled for ${formatScheduleToast(scheduleDate, scheduleTime)}.` });
        setScheduleOpen(false);
        setScheduleTarget(null);
      } catch (e: any) {
        setScheduleError(e?.message ?? "Failed to schedule job.");
      }
    } else {
      // Bulk
      const targets = jobs.filter((j) => selectedIds.has(j.dbId) && !NON_SCHEDULABLE.has(j.status));
      const skipped = selectedIds.size - targets.length;
      let ok = 0, fail = 0;
      for (const job of targets) {
        try {
          const { error } = await supabase
            .from("jobs")
            .update({ scheduled_date: scheduleDate, scheduled_time: scheduleTime, urgency: "Scheduled" })
            .eq("id", job.dbId);
          if (error) throw error;
          ok++;
        } catch {
          fail++;
        }
      }
      try {
        await supabase.from("admin_audit_logs").insert({
          user_id: userId, user_email: userEmail,
          action: "job.bulk_schedule",
          details: {
            job_ids: targets.map((t) => t.dbId),
            scheduledDate: scheduleDate,
            scheduledTime: scheduleTime,
            count: targets.length, ok, fail, skipped,
          },
        } as any);
      } catch { /* best-effort */ }
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setScheduleOpen(false);
      clearSelection();
      toast({
        title: "Bulk schedule complete",
        description: `${ok} scheduled${fail ? `, ${fail} failed` : ""}${skipped ? `, ${skipped} skipped` : ""} for ${formatScheduleToast(scheduleDate, scheduleTime)}.`,
        variant: fail > 0 ? "destructive" : "default",
      });
    }
    setBusy(false);
  };

  const runScheduleClear = async () => {
    if (scheduleMode !== "single" || !scheduleTarget) return;
    setBusy(true);
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const userEmail = (await supabase.auth.getUser()).data.user?.email ?? "";
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ scheduled_date: null, scheduled_time: "", urgency: "Anytime soon" })
        .eq("id", scheduleTarget.jobDbId);
      if (error) throw error;
      try {
        await supabase.from("admin_audit_logs").insert({
          user_id: userId, user_email: userEmail,
          action: "job.unschedule",
          details: {
            jobDbId: scheduleTarget.jobDbId,
            jobNumber: scheduleTarget.jobNumber,
            previousDate: scheduleTarget.scheduledDate ?? null,
            previousTime: scheduleTarget.scheduledTime ?? null,
          },
        } as any);
      } catch { /* best-effort */ }
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Schedule cleared" });
      setScheduleOpen(false);
      setScheduleTarget(null);
    } catch (e: any) {
      setScheduleError(e?.message ?? "Failed to clear schedule.");
    }
    setBusy(false);
  };

  const deleteCount = deleteTarget?.length ?? 0;
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
        <div className="ml-auto">
          <ScheduleDebugToggle enabled={debug} onChange={toggleDebug} />
        </div>
      </div>

      {debug && (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-[11px] font-mono text-muted-foreground">
          Debug column shows raw <span className="font-semibold">scheduledDate</span> /{" "}
          <span className="font-semibold">scheduledTime</span> from each job row.
          Red = parse failed.
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="h-4 w-4 mr-1" />Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setBulkAssignSpId(""); setBulkAssignOpen(true); }}>
              <UserPlus className="h-4 w-4 mr-2" />Assign Selected
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkUnassignOpen(true)}>
              <UserX className="h-4 w-4 mr-2" />Unassign Selected
            </Button>
            <Button size="sm" variant="outline" onClick={openScheduleBulk}>
              <CalendarClock className="h-4 w-4 mr-2" />Schedule Selected
            </Button>
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
              <th className="pb-3 font-medium text-muted-foreground">Scheduled</th>
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
                  <td className="py-3">
                    {(() => {
                      const blocked = NON_ASSIGNABLE.has(job.status);
                      const spName = job.assignedSpId ? spMap.get(job.assignedSpId) ?? "Unknown" : "";
                      if (job.assignedSpId) {
                        return (
                          <div className="flex items-center gap-1">
                            <span className="text-foreground">{spName}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              disabled={blocked}
                              title={blocked ? `Cannot unassign (${job.status})` : `Unassign ${spName}`}
                              onClick={() => setUnassignTarget({ jobDbId: job.dbId, jobNumber: job.id, spName })}
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      }
                      if (blocked) {
                        return <span className="text-muted-foreground">—</span>;
                      }
                      return (
                        <Select
                          value=""
                          onValueChange={(spId) => runAssignSingle(job.dbId, spId)}
                          disabled={assignJob.isPending}
                        >
                          <SelectTrigger className="h-8 w-[180px] text-xs">
                            <SelectValue placeholder="Assign to…" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeSps.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">No active SPs</div>
                            ) : (
                              activeSps.map((sp) => {
                                const matches = (sp.serviceCategories || []).includes(job.serviceCategory);
                                return (
                                  <SelectItem key={sp.id} value={sp.id}>
                                    <span className="flex items-center gap-2">
                                      <span>{sp.name}</span>
                                      {matches && (
                                        <span className="text-[10px] text-muted-foreground">· match</span>
                                      )}
                                    </span>
                                  </SelectItem>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {(() => {
                      const urgency = job.urgency || "Scheduled";
                      if (job.scheduledDate) {
                        const d = new Date(`${job.scheduledDate}T00:00:00`);
                        const dateStr = isNaN(d.getTime())
                          ? job.scheduledDate
                          : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                        const timeStr = job.scheduledTime ? formatScheduleToast("", job.scheduledTime).split("·").pop()?.trim() : "";
                        return (
                          <div className="flex flex-col leading-tight">
                            <span className="text-foreground">{dateStr}</span>
                            {job.scheduledTime && <span className="text-xs">{timeStr || job.scheduledTime}</span>}
                            {debug && (
                              <ScheduleDebugBadge
                                scheduledDate={job.scheduledDate}
                                scheduledTime={job.scheduledTime}
                              />
                            )}
                          </div>
                        );
                      }
                      return (
                        <div className="flex flex-col leading-tight">
                          {urgency === "ASAP" ? (
                            <span className="text-destructive font-medium">ASAP</span>
                          ) : urgency === "Anytime soon" ? (
                            <span>Flexible</span>
                          ) : (
                            <span className="italic">Not scheduled</span>
                          )}
                          {debug && (
                            <ScheduleDebugBadge
                              scheduledDate={job.scheduledDate}
                              scheduledTime={job.scheduledTime}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </td>
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
                      {!NON_SCHEDULABLE.has(job.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Schedule"
                          onClick={() => openScheduleSingle(job)}
                        >
                          <CalendarClock className="h-4 w-4" />
                        </Button>
                      )}
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

      {/* Unassign single confirmation */}
      <AlertDialog open={!!unassignTarget} onOpenChange={(o) => { if (!busy && !o) setUnassignTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unassign {unassignTarget?.spName} from {unassignTarget?.jobNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The job will revert to Created and any pending offers will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runUnassignSingle(); }}
              disabled={busy}
            >
              {busy ? "Unassigning…" : "Unassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Assign dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={(o) => { if (!busy) { setBulkAssignOpen(o); if (!o) setBulkAssignSpId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selectedIds.size} job{selectedIds.size === 1 ? "" : "s"} to an SP</DialogTitle>
            <DialogDescription>
              Jobs in In Progress, Completed, Cancelled, or Archived will be skipped. Jobs already assigned will be reassigned to the selected SP.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-assign-sp">Service Provider</Label>
            <Select value={bulkAssignSpId} onValueChange={setBulkAssignSpId}>
              <SelectTrigger id="bulk-assign-sp"><SelectValue placeholder="Pick an SP…" /></SelectTrigger>
              <SelectContent>
                {activeSps.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No active SPs</div>
                ) : (
                  activeSps.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.name}
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {(sp.serviceCategories || []).join(", ") || "no categories"}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkAssignOpen(false); setBulkAssignSpId(""); }} disabled={busy}>Cancel</Button>
            <Button onClick={runBulkAssign} disabled={busy || !bulkAssignSpId}>
              <UserPlus className="h-4 w-4 mr-2" />
              {busy ? "Assigning…" : `Assign ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Unassign confirmation */}
      <AlertDialog open={bulkUnassignOpen} onOpenChange={(o) => { if (!busy) setBulkUnassignOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign selected jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              Clears the assigned SP from selected jobs (Assigned/Accepted only) and cancels any pending offers. Other statuses are skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runBulkUnassign(); }}
              disabled={busy}
            >
              {busy ? "Unassigning…" : "Unassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule dialog (single or bulk) */}
      <Dialog open={scheduleOpen} onOpenChange={(o) => { if (!busy) { setScheduleOpen(o); if (!o) { setScheduleTarget(null); setScheduleError(""); } } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {scheduleMode === "single"
                ? `Schedule ${scheduleTarget?.jobNumber ?? "job"}`
                : `Schedule ${selectedIds.size} job${selectedIds.size === 1 ? "" : "s"}`}
            </DialogTitle>
            <DialogDescription>
              {scheduleMode === "single" && scheduleTarget?.customerName
                ? `Customer: ${scheduleTarget.customerName}`
                : "Applies the same date and time to all selected jobs. Completed, Cancelled, and Archived jobs are skipped."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-date">Date</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => { setScheduleDate(e.target.value); setScheduleError(""); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-time">Time</Label>
              <Select value={scheduleTime} onValueChange={(v) => { setScheduleTime(v); setScheduleError(""); }}>
                <SelectTrigger id="schedule-time"><SelectValue placeholder="Pick a time" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Setting a date/time will mark this job as Scheduled.
            </p>
            {scheduleError && (
              <p className="text-xs text-destructive">{scheduleError}</p>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <div>
              {scheduleMode === "single" && scheduleTarget?.scheduledDate && (
                <Button variant="ghost" onClick={runScheduleClear} disabled={busy} className="text-destructive hover:text-destructive">
                  Clear schedule
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setScheduleOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={runScheduleSave} disabled={busy}>
                <CalendarClock className="h-4 w-4 mr-2" />
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
