import { useServiceProviders, useJobs, useActiveServiceCategories } from "@/hooks/useSupabaseData";
import { useSpOffers, useAllSpOffers, useExpireStaleOffers, useDeclineOffer, type Offer } from "@/hooks/useOfferData";
import { JobServicesSummary } from "@/components/JobServicesDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { Link } from "react-router-dom";
import { MapPin, Clock, DollarSign, FileText, Timer, ChevronDown, ChevronUp, Info, CheckCircle, XCircle, AlertTriangle, Eye } from "lucide-react";
import { computeProximityResult } from "@/lib/proximity";
import { useEffect, useMemo, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { declineReasons } from "@/data/mockData";

function DeclineOfferDialog({
  open,
  onOpenChange,
  offerId,
  jobNumber,
  customerName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  offerId: string;
  jobNumber: string;
  customerName: string;
}) {
  const [reason, setReason] = useState("");
  const declineOffer = useDeclineOffer();

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const handleConfirm = () => {
    if (!reason) return;
    declineOffer.mutate(
      { offerId, declineReason: reason },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline Offer</DialogTitle>
          <DialogDescription>
            {jobNumber} · {customerName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Declining may affect your acceptance rate and reliability score.</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Reason <span className="text-destructive">*</span>
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {declineReasons.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={declineOffer.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason || declineOffer.isPending}
          >
            {declineOffer.isPending ? "Declining..." : "Confirm Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleText({ job }: { job: any }) {
  const urgency = job.urgency || "Scheduled";
  if (urgency === "ASAP") return <span>ASAP — dispatch ASAP</span>;
  if (urgency === "AnytimeSoon") return <span>Anytime soon — flexible</span>;
  return <span>{job.scheduledDate} · {job.scheduledTime}</span>;
}

function DiagnosticsPanel({ user, spId, currentSp, allOffers, pendingOffers }: {
  user: any;
  spId: string | null;
  currentSp: any;
  allOffers: Offer[];
  pendingOffers: Offer[];
}) {
  const [open, setOpen] = useState(false);

  const broadcastOffers = pendingOffers.filter(o => o.acceptance_source === "Broadcast");
  const allocationOffers = pendingOffers.filter(o => o.acceptance_source !== "Broadcast");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
        <Info className="h-3.5 w-3.5" />
        <span>Diagnostics</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 metric-card text-xs space-y-3">
          <div className="grid gap-1 sm:grid-cols-2">
            <span className="text-muted-foreground">User email:</span>
            <span className="font-mono">{user?.email ?? "(none)"}</span>
            <span className="text-muted-foreground">Resolved sp_id:</span>
            <span className="font-mono">{spId ?? "(none)"}</span>
            <span className="text-muted-foreground">SP name:</span>
            <span>{currentSp?.name ?? "(not found)"}</span>
            <span className="text-muted-foreground">Total offers (all statuses):</span>
            <span className="font-semibold">{allOffers.length}</span>
            <span className="text-muted-foreground">Pending offers:</span>
            <span className="font-semibold">{pendingOffers.length}</span>
            <span className="text-muted-foreground">↳ Allocation offers:</span>
            <span>{allocationOffers.length}</span>
            <span className="text-muted-foreground">↳ Broadcast offers:</span>
            <span>{broadcastOffers.length}</span>
          </div>

          {currentSp && (
            <div className="pt-2 border-t space-y-1">
              <p className="font-semibold text-muted-foreground">Auto-Accept Settings <span className="font-normal">(from service_providers table)</span></p>
              <div className="grid gap-1 sm:grid-cols-2">
                <span className="text-muted-foreground">Auto-Accept Enabled:</span>
                <span className={currentSp.autoAccept ? "text-primary font-semibold" : "font-semibold text-destructive"}>{currentSp.autoAccept ? "Yes ✓" : "No ✗"}</span>
                <span className="text-muted-foreground">Allowed categories:</span>
                <span>{currentSp.serviceCategories?.length ?? 0} ({currentSp.serviceCategories?.join(", ") || "none"})</span>
                <span className="text-muted-foreground">Travel radius:</span>
                <span>{currentSp.travelRadius} km</span>
                <span className="text-muted-foreground">Max jobs/day:</span>
                <span>{currentSp.maxJobsPerDay}</span>
              </div>
            </div>
          )}

          {pendingOffers.length === 0 && (
            <p className="text-muted-foreground pt-1 border-t">
              No offers are targeted to this SP. Offers have not been generated for this SP — ask admin to generate offers.
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EligibilityChecklist({ currentSp }: { currentSp: any }) {
  if (!currentSp) return null;

  const checks = [
    { label: "SP Status: Active", ok: currentSp.status === "Active", value: currentSp.status },
    { label: "Compliance: Valid", ok: currentSp.complianceStatus === "Valid", value: currentSp.complianceStatus },
    { label: "Categories assigned", ok: currentSp.serviceCategories?.length > 0, value: currentSp.serviceCategories?.join(", ") || "(none)" },
    { label: "Auto-accept enabled", ok: currentSp.autoAccept, value: currentSp.autoAccept ? "Yes" : "No", info: true },
    { label: "Travel radius set", ok: currentSp.travelRadius > 0, value: `${currentSp.travelRadius} km` },
  ];

  return (
    <div className="metric-card space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        Why am I not receiving offers?
      </h3>
      <div className="space-y-1.5">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {c.ok ? (
              <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
            <span className={c.ok ? "text-muted-foreground" : "text-foreground font-medium"}>
              {c.label}
            </span>
            <span className="text-muted-foreground ml-auto">{c.value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground pt-1 border-t">
        Offers are sent by the allocation engine based on job category, proximity, and availability. Contact admin if you believe there's an issue.
      </p>
    </div>
  );
}

export default function JobOffers() {
  const { user } = useAuth();
  const { data: serviceProviders = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();
  const activeCategories = useActiveServiceCategories();

  const spId = user?.spId ?? null;
  const { data: pendingOffers = [], refetch } = useSpOffers(spId);
  const { data: allOffers = [] } = useAllSpOffers(spId);
  const expireStale = useExpireStaleOffers();

  const currentSp = serviceProviders.find(sp => sp.id === spId);

  const [declineTarget, setDeclineTarget] = useState<{ offerId: string; jobNumber: string; customerName: string } | null>(null);

  // Expire stale offers
  useEffect(() => {
    expireStale.mutate();
  }, []);

  // Refresh periodically
  useEffect(() => {
    const iv = setInterval(() => {
      refetch();
      expireStale.mutate();
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  // Map offers to jobs
  const offerJobs = useMemo(() => {
    return pendingOffers
      .filter(o => new Date(o.expires_at) > new Date())
      .map(offer => {
        const job = jobs.find(j => j.dbId === offer.job_id);
        return job ? { offer, job } : null;
      })
      .filter(Boolean) as { offer: Offer; job: typeof jobs[0] }[];
  }, [pendingOffers, jobs]);

  // Past jobs assigned to this SP
  const myAssignedJobs = jobs.filter(j => j.assignedSpId === spId);

  function getDistanceDisplay(job: typeof jobs[0]) {
    if (!currentSp) return "N/A";
    const result = computeProximityResult(currentSp.baseAddress, job.jobAddress);
    if (result.distanceKm !== null) return `${result.distanceKm} km`;
    return "N/A";
  }

  const isLegacy = (cat: string) => activeCategories.length > 0 && !activeCategories.some((c) => c.name === cat);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">Job Offers</h1>
        <p className="mt-1 text-sm text-muted-foreground">{offerJobs.length} pending offer{offerJobs.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Diagnostics */}
      <DiagnosticsPanel
        user={user}
        spId={spId}
        currentSp={currentSp}
        allOffers={allOffers}
        pendingOffers={pendingOffers}
      />

      <div>
        <h2 className="section-title mb-4">Pending Offers</h2>
        {offerJobs.length === 0 ? (
          <div className="space-y-4">
            <div className="metric-card text-center py-8">
              <p className="text-muted-foreground">No pending offers right now</p>
            </div>
            {/* Show eligibility checklist when no offers */}
            <EligibilityChecklist currentSp={currentSp} />
          </div>
        ) : (
          <div className="space-y-3">
            {offerJobs.map(({ offer, job }) => {
              const minutesLeft = Math.max(0, Math.round((new Date(offer.expires_at).getTime() - Date.now()) / 60000));
              return (
                <div key={offer.id} className="metric-card flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/30 transition-colors">
                  <Link to={`/jobs/${job.dbId}?offer=${offer.id}`} className="flex-1 min-w-0 block">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{job.customerName}</p>
                      <StatusBadge label={
                        job.services && job.services.length > 0
                          ? (job.services.length === 1
                              ? (isLegacy(job.services[0].service_category) ? `(Legacy) ${job.services[0].service_category}` : job.services[0].service_category)
                              : `${job.services[0].service_category} +${job.services.length - 1}`)
                          : (isLegacy(job.serviceCategory) ? `(Legacy) ${job.serviceCategory}` : job.serviceCategory)
                      } variant="neutral" />
                      <UrgencyBadge urgency={job.urgency} />
                      {offer.acceptance_source === "Broadcast" && <StatusBadge label="Broadcast" variant="warning" />}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Timer className="h-3 w-3" /> {minutesLeft}m left
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{job.address}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{getDistanceDisplay(job)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.estimatedDuration}</span>
                      <span><ScheduleText job={job} /></span>
                    </div>
                    {job.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1">
                        <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="truncate">{job.notes.slice(0, 120)}{job.notes.length > 120 ? "..." : ""}</span>
                      </p>
                    )}
                  </Link>
                  <div className="flex sm:flex-col items-end gap-2 shrink-0">
                    <p className="text-xl font-bold text-primary flex items-center gap-1"><DollarSign className="h-4 w-4" />{job.payout}</p>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/jobs/${job.dbId}?offer=${offer.id}`}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeclineTarget({ offerId: offer.id, jobNumber: job.id, customerName: job.customerName })}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="section-title mb-4">Past & Assigned Jobs</h2>
        <div className="space-y-3">
          {myAssignedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past jobs yet.</p>
          ) : (
            myAssignedJobs.map((job) => {
              const variant = job.status === "Assigned" ? "info" : job.status === "Completed" ? "valid" : job.status === "Expired" || job.status === "Cancelled" ? "warning" : job.status === "InProgress" ? "info" : "error";
              return (
                <div key={job.dbId} className="metric-card flex items-center gap-4 opacity-80">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{job.customerName}</p>
                      <StatusBadge label={job.status} variant={variant} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {job.services && job.services.length > 0
                        ? job.services.map(s => s.service_category).join(", ")
                        : job.serviceCategory} · {job.scheduledDate}
                    </p>
                  </div>
                  <p className="text-lg font-bold">${job.payout}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
