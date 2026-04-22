import { useParams, Link, useSearchParams } from "react-router-dom";
import { JobServicesDisplay } from "@/components/JobServicesDisplay";
import { useJobs, useServiceProviders, useAssignJob, useActiveServiceCategories, useServiceCategories } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { useOffers, useCreateManualOffer, useGenerateBroadcastOffers, useGenerateOffers, useCancelOffers } from "@/hooks/useOfferData";
import { useActivePolicy, useFairnessContext, useSaveAllocationRun } from "@/hooks/useAllocationData";
import { runAllocation } from "@/lib/allocation-engine";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { ArrowLeft, MapPin, Calendar, Clock, DollarSign, User, Pencil, UserPlus, AlertCircle, FileText, Send, Radio, Bug, ChevronDown, FlaskConical, Zap, Shield } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useJobServices, useJobPhotos } from "@/hooks/useSupabaseData";
import { JobPhotosGallery } from "@/components/JobPhotosGallery";
import { Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

  const job = jobs.find((j) => j.dbId === id);
  const [showAssign, setShowAssign] = useState(searchParams.get("assign") === "true");
  const [selectedSpId, setSelectedSpId] = useState("");
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
    if (!selectedSpId || !id) return;
    // Cancel any pending offers first
    const pendingOffers = jobOffers.filter(o => o.status === "Pending");
    if (pendingOffers.length > 0) {
      await supabase.from("offers")
        .update({ status: "Cancelled" } as any)
        .eq("job_id", id)
        .eq("status", "Pending");
    }
    assignJob.mutate(
      { jobId: job!.dbId, spId: selectedSpId, assignedByUserId: user?.id ?? null },
      {
        onSuccess: () => {
          setShowAssign(false);
          refetchOffers();
          toast({ title: "SP assigned", description: `Job assigned directly. ${pendingOffers.length} pending offer(s) cancelled.` });
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

  const statusVariant = (s: string) => {
    switch (s) {
      case "Assigned": case "Accepted": return "info";
      case "InProgress": return "warning";
      case "Completed": return "valid";
      case "Cancelled": return "warning";
      default: return "neutral";
    }
  };

  const statusLabel = (s: string) => s === "InProgress" ? "In Progress" : s;

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
          <StatusBadge label={statusLabel(job.status)} variant={statusVariant(job.status) as any} />
          <UrgencyBadge urgency={job.urgency} />
          {job.isBroadcast && <StatusBadge label="Broadcast" variant="warning" />}
        </div>
        <Link to={`/admin/jobs/${job.dbId}/edit`}>
          <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />Edit</Button>
        </Link>
      </div>

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
            <div><p className="text-xs text-muted-foreground">Payout</p><p className="text-xl font-bold text-primary">${job.payout}</p></div>
          </div>
        </div>
      </div>

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

        {/* Assign SP inline form */}
        {showAssign && canDispatch && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Direct assignment will cancel all {jobOffers.filter(o => o.status === "Pending").length} pending offer(s).
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm">Service Provider</Label>
              <Select value={selectedSpId} onValueChange={setSelectedSpId}>
                <SelectTrigger><SelectValue placeholder="Choose an SP..." /></SelectTrigger>
                <SelectContent>
                  {providers.filter(sp => sp.status === "Active").map(sp => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.name} — {sp.baseAddress.city} · {sp.travelRadius}km
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAssign} disabled={!selectedSpId || assignJob.isPending}>
                {assignJob.isPending ? "Assigning..." : "Assign Directly"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAssign(false); setSelectedSpId(""); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* ====== OFFERS PANEL ====== */}
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

      {/* Assignment panel */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Assignment</h2>
        {assignedSp ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
              {assignedSp.avatar}
            </div>
            <div>
              <p className="font-medium">{assignedSp.name}</p>
              <p className="text-xs text-muted-foreground">{assignedSp.baseAddress.city} · {assignedSp.travelRadius} km radius · {assignedSp.complianceStatus}</p>
            </div>
            <Link to={`/admin/providers/${assignedSp.id}`} className="ml-auto text-xs text-primary hover:underline">
              View SP →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No SP assigned yet.</p>
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
            <p><strong>payout:</strong> ${job.payout}</p>
            <p><strong>line_totals sum:</strong> ${directJobServices.reduce((s, svc) => s + svc.line_total, 0).toFixed(2)}</p>
            <p><strong>pending offers:</strong> {jobOffers.filter(o => o.status === "Pending").length}</p>
            <p><strong>total offers:</strong> {jobOffers.length}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
