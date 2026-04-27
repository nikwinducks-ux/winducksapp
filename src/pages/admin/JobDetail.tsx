import { useParams, Link, useSearchParams } from "react-router-dom";
import { formatCAD } from "@/lib/currency";
import { JobServicesDisplay } from "@/components/JobServicesDisplay";
import { useJobs, useServiceProviders, useAssignJob, useActiveServiceCategories, useServiceCategories, useJobCrew, useAddCrewMember, useRemoveCrewMember, useSetCrewLead, useAppSettings } from "@/hooks/useSupabaseData";
import { effectiveCompSplit, splitInvoice, formatMarketingRecipient } from "@/lib/compensation";
import { useAuth } from "@/contexts/AuthContext";
import { useOffers, useCreateManualOffer, useGenerateBroadcastOffers, useGenerateOffers, useCancelOffers } from "@/hooks/useOfferData";
import { useActivePolicy, useFairnessContext, useSaveAllocationRun } from "@/hooks/useAllocationData";
import { runAllocation } from "@/lib/allocation-engine";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { getJobDisplayStatus } from "@/lib/jobStatus";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { ArrowLeft, MapPin, Calendar, Clock, DollarSign, User, Pencil, UserPlus, AlertCircle, FileText, Send, Radio, Bug, ChevronDown, FlaskConical, Zap, Shield, Users, Star, X, Plus } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useJobServices } from "@/hooks/useSupabaseData";
import { JobPhotosCard } from "@/components/JobPhotosCard";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CrewPicker } from "@/components/admin/CrewPicker";
import { useConvertJobToInvoice } from "@/hooks/useCustomerInvoices";
import { JobDepositCard } from "@/components/admin/JobDepositCard";
import { useNavigate } from "react-router-dom";
import { WorkflowStepper, buildJobStages } from "@/components/workflow/WorkflowStepper";
import { ActivityTimelineCard } from "@/components/workflow/ActivityTimeline";
import { useJobTimeline } from "@/hooks/useWorkflowEvents";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function ScheduleDisplay({ job }: { job: any }) {
  const urgency = job.urgency || "Scheduled";
  if (urgency === "ASAP") return <p className="font-medium">ASAP — dispatch as soon as possible</p>;
  if (urgency === "AnytimeSoon") return <p className="font-medium">Anytime soon — flexible timing</p>;
  return <p className="font-medium">{job.scheduledDate || "Not scheduled"} {job.scheduledTime && `· ${job.scheduledTime}`}</p>;
}

export default function JobDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { data: jobs = [] } = useJobs();
  const { data: providers = [] } = useServiceProviders();
  const { user } = useAuth();
  const assignJob = useAssignJob();
  const activeCategories = useActiveServiceCategories();
  const { data: allCategories = [] } = useServiceCategories();
  const { data: jobOffers = [], refetch: refetchOffers } = useOffers(id);
  const { data: directJobServices = [] } = useJobServices(id);
  const createManualOffer = useCreateManualOffer();
  const generateBroadcast = useGenerateBroadcastOffers();
  const generateOffers = useGenerateOffers();
  const activePolicy = useActivePolicy();
  const { data: fairnessCtx } = useFairnessContext(activePolicy?.fairness_json?.rollingWindow ?? 30);
  const saveRun = useSaveAllocationRun();
  const { toast } = useToast();
  const { data: crew = [] } = useJobCrew(id);
  const { data: settings } = useAppSettings();
  const addCrew = useAddCrewMember();
  const removeCrew = useRemoveCrewMember();
  const setLead = useSetCrewLead();
  const [addCrewSpId, setAddCrewSpId] = useState("");
  const convertToInvoice = useConvertJobToInvoice();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: timeline = [], isLoading: timelineLoading } = useJobTimeline(id);
  const { data: jobMeta } = useQuery({
    queryKey: ["job_meta", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase.from("jobs")
        .select("source_estimate_id")
        .eq("id", id).maybeSingle();
      return data;
    },
    enabled: !!id,
  });
  const { data: linkedInvoiceId } = useQuery({
    queryKey: ["linked_invoice_for_job", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase.from("customer_invoices")
        .select("id").eq("job_id", id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!id,
  });
  const markReady = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.rpc("mark_job_ready_to_invoice", { _job_id: jobId });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job_timeline", id] });
      toast({ title: "Marked ready to invoice" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const job = jobs.find((j) => j.dbId === id);
  const [showAssign, setShowAssign] = useState(searchParams.get("assign") === "true");
  const [selectedSpIds, setSelectedSpIds] = useState<string[]>([]);
  const [showSendOffer, setShowSendOffer] = useState(false);
  const [offerSpId, setOfferSpId] = useState("");
  const [offerExpiry, setOfferExpiry] = useState(30);
  const [broadcastExpiry, setBroadcastExpiry] = useState(30);
  const [generatingAllocation, setGeneratingAllocation] = useState(false);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Job not found</p>
        <Link to="/admin/jobs" className="text-primary hover:underline mt-2 text-sm">Back to Jobs</Link>
      </div>
    );
  }

  const assignedSp = providers.find((sp) => sp.id === job.assignedSpId);
  const isLegacyCategory = activeCategories.length > 0 && !activeCategories.some((c) => c.name === job.serviceCategory);

  // === State gating ===
  const canDispatch = ["Created", "Offered"].includes(job.status) && !job.assignedSpId;
  const isAssigned = !!job.assignedSpId || ["Assigned", "InProgress", "Completed"].includes(job.status);

  // Existing pending offer sp_ids for duplicate prevention
  const pendingOfferSpIds = new Set(
    jobOffers.filter(o => o.status === "Pending").map(o => o.sp_id)
  );

  // === Handlers ===

  const handleAssign = async () => {
    if (selectedSpIds.length === 0 || !id) return;
    const pendingOffers = jobOffers.filter(o => o.status === "Pending");
    if (pendingOffers.length > 0) {
      await supabase.from("offers")
        .update({ status: "Cancelled" } as any)
        .eq("job_id", id)
        .eq("status", "Pending");
    }
    assignJob.mutate(
      { jobId: job!.dbId, spIds: selectedSpIds, leadSpId: selectedSpIds[0], assignedByUserId: user?.id ?? null },
      {
        onSuccess: () => {
          setShowAssign(false);
          setSelectedSpIds([]);
          refetchOffers();
          toast({ title: "Crew assigned", description: `${selectedSpIds.length} SP(s) assigned. ${pendingOffers.length} pending offer(s) cancelled.` });
        },
      }
    );
  };

  const handleSendOffer = async () => {
    if (!offerSpId || !id) return;
    // Duplicate check
    if (pendingOfferSpIds.has(offerSpId)) {
      toast({ title: "Duplicate offer", description: "This SP already has a pending offer for this job.", variant: "destructive" });
      return;
    }
    await createManualOffer.mutateAsync({
      jobId: id,
      spId: offerSpId,
      expiryMinutes: offerExpiry,
      createdBy: user?.id ?? "system",
    });
    setShowSendOffer(false);
    setOfferSpId("");
    refetchOffers();
  };

  const handleGenerateAllocationOffers = async () => {
    if (!job || !activePolicy || !fairnessCtx || !id) return;
    setGeneratingAllocation(true);
    try {
      const candidates = runAllocation(job, providers, activePolicy.weights_json, activePolicy.fairness_json, fairnessCtx);
      const eligible = candidates.filter(c => c.eligibilityStatus === "Eligible");
      if (eligible.length === 0) {
        toast({ title: "No eligible SPs", description: "No service providers passed eligibility checks for this job.", variant: "destructive" });
        setGeneratingAllocation(false);
        return;
      }
      const runId = await saveRun.mutateAsync({
        jobId: job.dbId,
        policyId: activePolicy.id,
        selectedSpId: eligible[0]?.sp.id ?? null,
        candidates,
        userId: user?.id,
        label: `Job Detail — ${activePolicy.version_name}`,
      });
      // Filter out SPs that already have pending offers
      const topSpIds = eligible
        .slice(0, 3)
        .map(c => c.sp.id)
        .filter(spId => !pendingOfferSpIds.has(spId));

      if (topSpIds.length === 0) {
        toast({ title: "All top SPs already have pending offers", description: "No new offers created.", variant: "destructive" });
        setGeneratingAllocation(false);
        return;
      }

      await generateOffers.mutateAsync({
        jobId: job.dbId,
        allocationRunId: runId,
        topSpIds,
        serviceProviders: providers,
        job,
        expiryMinutes: offerExpiry,
        createdBy: user?.id ?? "system",
      });
      refetchOffers();
      toast({ title: "Offers generated", description: `Created ${topSpIds.length} offer(s) via Allocation.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setGeneratingAllocation(false);
  };

  const handleBroadcast = async () => {
    if (!job || !id) return;
    // If not marked as broadcast, toggle it on
    if (!job.isBroadcast) {
      await supabase.from("jobs").update({ is_broadcast: true }).eq("id", id);
    }
    await generateBroadcast.mutateAsync({
      job: { ...job, isBroadcast: true },
      serviceProviders: providers,
      expiryMinutes: broadcastExpiry,
      createdBy: user?.id ?? "system",
    });
    refetchOffers();
  };

  // Job status display centralized in src/lib/jobStatus.ts

  const offerVariant = (s: string) => {
    switch (s) {
      case "Accepted": return "valid";
      case "Pending": return "info";
      case "Declined": return "warning";
      case "Expired": return "warning";
      case "Cancelled": return "error";
      default: return "neutral";
    }
  };

  const sourceIcon = (src: string) => {
    switch (src) {
      case "AutoAccept": return "⚡";
      case "Broadcast": return "📡";
      case "Allocation": return "🧪";
      case "Manual": return "✋";
      default: return "📨";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <Link to="/admin/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Jobs
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="page-header">{job.id}</h1>
          {(() => { const ds = getJobDisplayStatus(job); return <StatusBadge label={ds.label} variant={ds.variant} />; })()}
          <UrgencyBadge urgency={job.urgency} />
          {job.isBroadcast && <StatusBadge label="Broadcast" variant="warning" />}
        </div>
        <Link to={`/admin/jobs/${job.dbId}/edit`}>
          <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />Edit</Button>
        </Link>
      </div>

      <WorkflowStepper stages={buildJobStages(
        { status: job.status, assignedSpId: job.assignedSpId, source_estimate_id: jobMeta?.source_estimate_id ?? null },
        { estimateId: jobMeta?.source_estimate_id ?? null, invoiceId: linkedInvoiceId },
      )} />

      {/* Customer summary */}
      <div className="metric-card space-y-3">
        <h2 className="section-title">Customer</h2>
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{job.customerName}</p>
            {job.customerId && (
              <Link to={`/admin/customers/${job.customerId}`} className="text-xs text-primary hover:underline">
                View customer profile →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Job info */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Job Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div><p className="text-xs text-muted-foreground">Address</p><p className="font-medium">{job.address}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div><p className="text-xs text-muted-foreground">Schedule</p><ScheduleDisplay job={job} /></div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div><p className="text-xs text-muted-foreground">Duration</p><p className="font-medium">{job.estimatedDuration || "—"}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div><p className="text-xs text-muted-foreground">Total Invoice</p><p className="text-xl font-bold text-primary">{formatCAD(job.payout)}</p></div>
          </div>
        </div>
      </div>

      <JobDepositCard
        jobId={job.dbId}
        depositDue={job.depositDue ?? 0}
        depositReceived={job.depositReceived ?? 0}
        depositReceivedAt={job.depositReceivedAt ?? null}
        sourceEstimateId={job.sourceEstimateId ?? null}
      />

      {/* Compensation Breakdown */}
      {(() => {
        const assignedSp = providers.find((p) => p.id === job.assignedSpId);
        const pcts = effectiveCompSplit(assignedSp ?? null, settings ?? null);
        const split = splitInvoice(job.payout, pcts);
        const recipientLabel = formatMarketingRecipient(job.marketingRecipient, job.marketingRecipientName, assignedSp?.name);
        const crewSize = Math.max(1, crew.length);
        const perSp = Math.round((split.sp / crewSize) * 100) / 100;
        return (
          <div className="metric-card space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="section-title">Compensation Breakdown</h2>
              {assignedSp ? (
                <Link to={`/admin/providers/${assignedSp.id}?tab=compensation`} className="text-xs text-primary hover:underline">
                  View {assignedSp.name}'s compensation settings →
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">No SP assigned — using global defaults</span>
              )}
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1.5 font-semibold">Total Invoice</td>
                  <td className="py-1.5 text-right font-semibold">{formatCAD(split.total)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-muted-foreground">− Winducks (Platform Fee {pcts.platformPct}%)</td>
                  <td className="py-1.5 text-right text-muted-foreground">−{formatCAD(split.platform)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-muted-foreground">
                    − Marketing ({pcts.marketingPct}%) → <span className="font-medium text-foreground">{recipientLabel}</span>
                  </td>
                  <td className="py-1.5 text-right text-muted-foreground">−{formatCAD(split.marketing)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 font-semibold">= SP Portion ({pcts.spPct}%)</td>
                  <td className="py-2 text-right text-lg font-bold text-success">{formatCAD(split.sp)}</td>
                </tr>
                {crew.length > 1 && (
                  <tr>
                    <td className="py-1.5 text-xs text-muted-foreground">Per crew member ({crew.length} SPs)</td>
                    <td className="py-1.5 text-right text-xs text-muted-foreground">{formatCAD(perSp)} each</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="text-[11px] text-muted-foreground">
              Percentages come from {assignedSp ? `${assignedSp.name}'s compensation settings` : "the global defaults on the Payouts page"}.
              Changing the global % updates this breakdown for all jobs (past and future) automatically.
            </p>
          </div>
        );
      })()}

      {/* Services */}
      {directJobServices.length > 0 && (
        <div className="metric-card space-y-3">
          <h2 className="section-title">Services ({directJobServices.length})</h2>
          <JobServicesDisplay services={directJobServices} categories={allCategories} />
        </div>
      )}
      {directJobServices.length === 0 && job.serviceCategory && (
        <div className="metric-card space-y-3">
          <h2 className="section-title">Service</h2>
          <p className="font-medium">{isLegacyCategory ? `(Legacy) ${job.serviceCategory}` : job.serviceCategory}</p>
        </div>
      )}

      {/* Notes */}
      {job.notes && (
        <div className="metric-card space-y-3">
          <h2 className="section-title flex items-center gap-2"><FileText className="h-4 w-4" />Job Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      {/* Photos */}
      <JobPhotosCard jobId={id} />


      {/* ====== DISPATCH ACTIONS ====== */}
      <div className="metric-card space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="section-title">Dispatch Actions</h2>
        </div>

        {isAssigned && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
            <Shield className="h-4 w-4" />
            <span>Job is already assigned ({job.status}). Dispatch actions are locked.</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={handleGenerateAllocationOffers}
            disabled={!canDispatch || generatingAllocation || !activePolicy}
          >
            <FlaskConical className="h-4 w-4 mr-1" />
            {generatingAllocation ? "Generating..." : "Generate Offers (Allocation)"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleBroadcast}
            disabled={!canDispatch || generateBroadcast.isPending}
          >
            <Radio className="h-4 w-4 mr-1" />
            {generateBroadcast.isPending ? "Broadcasting..." : "Broadcast Offers"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSendOffer(!showSendOffer)}
            disabled={!canDispatch}
          >
            <Send className="h-4 w-4 mr-1" />Send Offer to SP
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowAssign(!showAssign)}
            disabled={!canDispatch}
          >
            <UserPlus className="h-4 w-4 mr-1" />Assign SP Directly
          </Button>
        </div>

        {/* Send Offer inline form */}
        {showSendOffer && canDispatch && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Service Provider</Label>
                <Select value={offerSpId} onValueChange={setOfferSpId}>
                  <SelectTrigger><SelectValue placeholder="Select an SP..." /></SelectTrigger>
                  <SelectContent>
                    {providers.filter(sp => sp.status === "Active").map(sp => {
                      const hasPending = pendingOfferSpIds.has(sp.id);
                      return (
                        <SelectItem key={sp.id} value={sp.id} disabled={hasPending}>
                          {sp.name} — {sp.baseAddress.city} {hasPending ? "(pending offer)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Expiry (minutes)</Label>
                <Input type="number" min={1} max={120} value={offerExpiry} onChange={e => setOfferExpiry(parseInt(e.target.value) || 30)} className="w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSendOffer} disabled={!offerSpId || createManualOffer.isPending}>
                {createManualOffer.isPending ? "Sending..." : "Send Offer"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowSendOffer(false); setOfferSpId(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Assign Crew inline form */}
        {showAssign && canDispatch && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Select one or more SPs. The first selected becomes Lead (click ★ to change). Direct assignment will cancel all {jobOffers.filter(o => o.status === "Pending").length} pending offer(s).
            </p>
            <CrewPicker
              providers={providers}
              value={selectedSpIds.map((spId, i) => ({ spId, isLead: i === 0 }))}
              onChange={(next) => {
                // Keep order — lead first
                const lead = next.find((m) => m.isLead);
                const others = next.filter((m) => !m.isLead);
                setSelectedSpIds(lead ? [lead.spId, ...others.map((o) => o.spId)] : others.map((o) => o.spId));
              }}
              payout={job.payout}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAssign} disabled={selectedSpIds.length === 0 || assignJob.isPending}>
                {assignJob.isPending ? "Assigning..." : `Assign ${selectedSpIds.length || ""} SP${selectedSpIds.length === 1 ? "" : "s"}`.trim()}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAssign(false); setSelectedSpIds([]); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* ====== INVOICE ACTIONS ====== */}
      {["Completed", "ReadyToInvoice", "ConvertedToInvoice", "InvoiceSent"].includes(job.status) && (
        <div className="metric-card space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="section-title">Invoice</h2>
          </div>
          {job.status === "Completed" && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => id && markReady.mutate(id)}
                disabled={markReady.isPending}
              >
                {markReady.isPending ? "Marking..." : "Mark ready to invoice"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!id) return;
                  convertToInvoice.mutate(id, {
                    onSuccess: (res) => {
                      if (res?.invoice_id) navigate(`/admin/invoices/${res.invoice_id}`);
                    },
                  });
                }}
                disabled={convertToInvoice.isPending}
              >
                <FileText className="h-4 w-4 mr-1" />
                {convertToInvoice.isPending ? "Converting..." : "Create invoice"}
              </Button>
            </div>
          )}
          {job.status === "ReadyToInvoice" && (
            <>
              <p className="text-sm text-muted-foreground">
                Job has been reviewed and is ready to invoice.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  if (!id) return;
                  convertToInvoice.mutate(id, {
                    onSuccess: (res) => {
                      if (res?.invoice_id) navigate(`/admin/invoices/${res.invoice_id}`);
                    },
                  });
                }}
                disabled={convertToInvoice.isPending}
              >
                <FileText className="h-4 w-4 mr-1" />
                {convertToInvoice.isPending ? "Converting..." : "Create invoice"}
              </Button>
            </>
          )}
          {(job.status === "ConvertedToInvoice" || job.status === "InvoiceSent") && (
            <>
              <p className="text-sm text-muted-foreground">
                {job.status === "InvoiceSent" ? "Invoice has been sent to the customer." : "Draft invoice exists for this job."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => linkedInvoiceId && navigate(`/admin/invoices/${linkedInvoiceId}`)}
                disabled={!linkedInvoiceId}
              >
                <FileText className="h-4 w-4 mr-1" />Open invoice
              </Button>
            </>
          )}
        </div>
      )}


      <div className="metric-card space-y-4">
        <h2 className="section-title">Offers ({jobOffers.length})</h2>

        {jobOffers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No offers sent for this job yet.</p>
        ) : (
          <div className="space-y-2">
            {jobOffers.map(offer => {
              const sp = providers.find(s => s.id === offer.sp_id);
              const isExpired = offer.status === "Pending" && new Date(offer.expires_at) < new Date();
              const displayStatus = isExpired ? "Expired" : offer.status;
              return (
                <div key={offer.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {sourceIcon(offer.acceptance_source)} {sp?.name ?? offer.sp_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Source: {offer.acceptance_source}
                      {" · "}Offered {new Date(offer.offered_at).toLocaleString()}
                      {offer.expires_at && ` · Expires ${new Date(offer.expires_at).toLocaleString()}`}
                    </p>
                    {offer.responded_at && (
                      <p className="text-xs text-muted-foreground">
                        Responded: {new Date(offer.responded_at).toLocaleString()}
                        {offer.decline_reason && ` · Reason: ${offer.decline_reason}`}
                      </p>
                    )}
                  </div>
                  <StatusBadge label={displayStatus} variant={offerVariant(displayStatus) as any} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Crew panel */}
      <div className="metric-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <Users className="h-4 w-4" />
            Crew ({crew.length})
          </h2>
          {crew.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {formatCAD(job.payout / crew.length)} per SP (= {formatCAD(job.payout)} ÷ {crew.length})
            </p>
          )}
        </div>

        {crew.length === 0 ? (
          <p className="text-sm text-muted-foreground">No SPs assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {crew.map((m) => {
              const sp = providers.find((p) => p.id === m.spId);
              const canRemove = !["Completed", "Cancelled"].includes(job.status);
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-md border p-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {sp?.avatar ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sp?.name ?? "Unknown SP"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {sp?.baseAddress.city} · {sp?.travelRadius} km · {sp?.complianceStatus}
                    </p>
                  </div>
                  {sp && (
                    <Link to={`/admin/providers/${sp.id}`} className="text-xs text-primary hover:underline">
                      View
                    </Link>
                  )}
                  <Button
                    size="sm"
                    variant={m.isLead ? "default" : "ghost"}
                    onClick={() => !m.isLead && setLead.mutate({ jobId: job.dbId, spId: m.spId })}
                    disabled={m.isLead || setLead.isPending}
                    className="h-7 px-2 text-xs"
                  >
                    <Star className={`h-3 w-3 ${m.isLead ? "fill-current" : ""}`} />
                    {m.isLead ? " Lead" : ""}
                  </Button>
                  {canRemove && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remove ${sp?.name ?? "this SP"} from the crew?`)) {
                          removeCrew.mutate({ jobId: job.dbId, spId: m.spId });
                        }
                      }}
                      disabled={removeCrew.isPending}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add crew member */}
        {crew.length > 0 && !["Completed", "Cancelled"].includes(job.status) && (
          <div className="flex gap-2 items-end pt-2 border-t">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Add SP to crew</Label>
              <Select value={addCrewSpId} onValueChange={setAddCrewSpId}>
                <SelectTrigger><SelectValue placeholder="Select SP..." /></SelectTrigger>
                <SelectContent>
                  {providers
                    .filter((sp) => sp.status === "Active" && !crew.some((c) => c.spId === sp.id))
                    .map((sp) => (
                      <SelectItem key={sp.id} value={sp.id}>
                        {sp.name} — {sp.baseAddress.city}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (!addCrewSpId) return;
                addCrew.mutate(
                  { jobId: job.dbId, spId: addCrewSpId, userId: user?.id ?? null },
                  { onSuccess: () => setAddCrewSpId("") }
                );
              }}
              disabled={!addCrewSpId || addCrew.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />Add
            </Button>
          </div>
        )}
      </div>

      {/* Debug panel */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Bug className="h-4 w-4" /> Debug: job_services
            <ChevronDown className="h-3 w-3" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="metric-card mt-2 space-y-2 text-xs font-mono">
            <p><strong>job_id:</strong> {job.dbId}</p>
            <p><strong>job_services count:</strong> {directJobServices.length}</p>
            <p><strong>categories:</strong> {directJobServices.map(s => s.service_category).join(", ") || "—"}</p>
            <p><strong>codes:</strong> {directJobServices.map(s => {
              const cat = allCategories.find(c => c.name === s.service_category);
              return cat?.code || s.service_category;
            }).join(", ") || "—"}</p>
            <p><strong>payout:</strong> {formatCAD(job.payout)}</p>
            <p><strong>line_totals sum:</strong> {formatCAD(directJobServices.reduce((s, svc) => s + svc.line_total, 0))}</p>
            <p><strong>pending offers:</strong> {jobOffers.filter(o => o.status === "Pending").length}</p>
            <p><strong>total offers:</strong> {jobOffers.length}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ActivityTimelineCard events={timeline} loading={timelineLoading} emptyMessage="No job activity yet." />
    </div>
  );
}
