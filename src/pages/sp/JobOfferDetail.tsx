import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useServiceProviders, useJobs, useActiveServiceCategories, useServiceCategories } from "@/hooks/useSupabaseData";
import { JobServicesDisplay } from "@/components/JobServicesDisplay";
import { useAcceptOffer, useDeclineOffer, useOffers } from "@/hooks/useOfferData";
import { useAuth } from "@/contexts/AuthContext";
import { declineReasons } from "@/data/mockData";
import { ScoreBar } from "@/components/ScoreBar";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, MapPin, Clock, Calendar, DollarSign, User, AlertCircle, Info, FileText, Timer } from "lucide-react";
import { useState, useMemo } from "react";
import { computeProximityResult, PROXIMITY_TOOLTIP, DISTANCE_SOURCE_LABELS } from "@/lib/proximity";
import { JobPhotosCard } from "@/components/JobPhotosCard";

function ScheduleDisplay({ job }: { job: any }) {
  const urgency = job.urgency || "Scheduled";
  if (urgency === "ASAP") return <p className="font-medium">ASAP — dispatch as soon as possible</p>;
  if (urgency === "AnytimeSoon") return <p className="font-medium">Anytime soon — flexible timing</p>;
  return <p className="font-medium">{job.scheduledDate} · {job.scheduledTime}</p>;
}

export default function JobOfferDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const offerId = searchParams.get("offer");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: serviceProviders = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();
  const activeCategories = useActiveServiceCategories();
  const { data: allCategories = [] } = useServiceCategories();
  const { data: jobOffers = [] } = useOffers(id);
  const acceptOffer = useAcceptOffer();
  const declineOffer = useDeclineOffer();
  const job = jobs.find((j) => j.dbId === id);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const currentSp = serviceProviders.find((sp) => sp.id === user?.spId);
  const isLegacy = job && activeCategories.length > 0 && !activeCategories.some((c) => c.name === job.serviceCategory);

  // Find the specific offer for this SP
  const myOffer = useMemo(() => {
    if (offerId) return jobOffers.find(o => o.id === offerId);
    return jobOffers.find(o => o.sp_id === user?.spId && o.status === "Pending");
  }, [jobOffers, offerId, user?.spId]);

  const distanceInfo = useMemo(() => {
    if (!job || !currentSp) return { distance: null, needsGeocoding: true, score: 0, source: "fallback" as const };
    const result = computeProximityResult(currentSp.baseAddress, job.jobAddress);
    return { distance: result.distanceKm, needsGeocoding: result.source === "fallback", score: result.score, source: result.source };
  }, [job, currentSp]);

  if (!user?.spId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 metric-card max-w-lg mx-auto text-center space-y-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-semibold text-destructive">Account Not Linked</p>
        <p className="text-sm text-muted-foreground">Your account is not linked to a Service Provider profile. Contact admin.</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Job not found</p>
        <Link to="/jobs" className="text-primary hover:underline mt-2 text-sm">Back to Jobs</Link>
      </div>
    );
  }

  const isAccepted = job.status === "Assigned" && job.assignedSpId === user.spId;
  const isDeclined = myOffer?.status === "Declined";
  const isExpired = myOffer ? new Date(myOffer.expires_at) < new Date() && myOffer.status === "Pending" : false;
  const isPending = myOffer?.status === "Pending" && !isExpired;
  const minutesLeft = myOffer && isPending
    ? Math.max(0, Math.round((new Date(myOffer.expires_at).getTime() - Date.now()) / 60000))
    : null;

  const handleAccept = () => {
    if (!myOffer) return;
    acceptOffer.mutate(
      { offerId: myOffer.id, jobId: job.dbId, spId: user.spId! },
      { onSuccess: () => setTimeout(() => navigate("/my-jobs"), 800) }
    );
  };

  const handleDecline = () => {
    if (!myOffer || !declineReason) return;
    declineOffer.mutate(
      { offerId: myOffer.id, declineReason },
    );
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Job Offers
      </Link>

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="page-header">{job.id}</h1>
          {isAccepted && <StatusBadge label="Accepted" variant="valid" />}
          {isDeclined && <StatusBadge label="Declined" variant="warning" />}
          {isExpired && <StatusBadge label="Expired" variant="warning" />}
          {isPending && <StatusBadge label="Pending" variant="info" />}
          <UrgencyBadge urgency={job.urgency} />
        </div>
        {isPending && minutesLeft !== null && (
          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" /> Offer expires in {minutesLeft} minutes
          </p>
        )}
      </div>

      {/* Job Details card */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Job Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{job.customerName}</p></div></div>
          <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Address</p><p className="font-medium">{job.address}</p></div></div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div><p className="text-xs text-muted-foreground">Schedule</p><ScheduleDisplay job={job} /></div>
          </div>
          <div className="flex items-center gap-3"><Clock className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Duration</p><p className="font-medium">{job.estimatedDuration}</p></div></div>
          <div className="flex items-center gap-3"><DollarSign className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Payout</p><p className="text-xl font-bold text-primary">${job.payout}</p></div></div>
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Distance from you</p>
              {distanceInfo.distance !== null ? (
                <>
                  <p className="font-medium">{distanceInfo.distance} km</p>
                  <p className="text-xs text-muted-foreground">Source: {DISTANCE_SOURCE_LABELS[distanceInfo.source]}</p>
                </>
              ) : (
                <span className="status-badge bg-warning/10 text-warning">Needs geocoding</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Service Category</p>
              <p className="font-medium">{isLegacy ? `(Legacy) ${job.serviceCategory}` : job.serviceCategory}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services */}
      {job.services && job.services.length > 0 && (
        <div className="metric-card space-y-3">
          <h2 className="section-title">Services ({job.services.length})</h2>
          <JobServicesDisplay services={job.services} categories={allCategories} />
        </div>
      )}

      {/* Job Notes */}
      {job.notes && (
        <div className="metric-card space-y-3">
          <h2 className="section-title flex items-center gap-2"><FileText className="h-4 w-4" />Job Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      {/* Photos */}
      <JobPhotosCard jobId={id} />

      {/* Allocation Transparency */}
      {job.scores && (
        <div className="metric-card space-y-4">
          <h2 className="section-title">Allocation Transparency</h2>
          <p className="text-sm text-muted-foreground">Breakdown of your allocation score for this job</p>
          <div className="space-y-3">
            <ScoreBar label="Availability Fit" value={job.scores.availabilityFit} />
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm text-muted-foreground">Proximity</span>
                <Tooltip><TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs text-xs">{PROXIMITY_TOOLTIP}</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1"><div className="score-bar-track"><div className="score-bar" style={{ width: `${distanceInfo.score}%` }} /></div></div>
                <span className="text-sm font-semibold w-12 text-right">{distanceInfo.score}%</span>
              </div>
              {distanceInfo.distance !== null && <p className="text-xs text-muted-foreground mt-0.5">{distanceInfo.distance} km → score {distanceInfo.score}</p>}
            </div>
            <ScoreBar label="Competency" value={job.scores.competency} />
            <ScoreBar label="Reliability" value={job.scores.reliability} />
            <ScoreBar label="Rating" value={job.scores.rating} />
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fairness Adjustment</span>
                <span className={`font-medium ${job.scores.fairnessAdjustment >= 0 ? "text-success" : "text-destructive"}`}>
                  {job.scores.fairnessAdjustment >= 0 ? "+" : ""}{job.scores.fairnessAdjustment}%
                </span>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Final Allocation Score</span>
                <span className="text-2xl font-bold text-primary">{job.scores.finalScore}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="metric-card space-y-4">
          <h2 className="section-title">Actions</h2>
          {!showDecline ? (
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleAccept} disabled={acceptOffer.isPending}>
                {acceptOffer.isPending ? "Accepting…" : "Accept Job"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowDecline(true)} disabled={acceptOffer.isPending}>Decline Job</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-warning">Declining may affect your acceptance rate and reliability score.</p>
              </div>
              <Select value={declineReason} onValueChange={setDeclineReason}>
                <SelectTrigger><SelectValue placeholder="Select decline reason" /></SelectTrigger>
                <SelectContent>
                  {declineReasons.map((reason) => (<SelectItem key={reason} value={reason}>{reason}</SelectItem>))}
                </SelectContent>
              </Select>
              <div className="flex gap-3">
                <Button variant="destructive" disabled={!declineReason || declineOffer.isPending} onClick={handleDecline} className="flex-1">
                  {declineOffer.isPending ? "Declining…" : "Confirm Decline"}
                </Button>
                <Button variant="outline" onClick={() => setShowDecline(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {isAccepted && (
        <div className="metric-card border-success/30 bg-success/5 text-center py-6">
          <p className="text-lg font-semibold text-success">✓ Job Accepted Successfully</p>
          <p className="text-sm text-muted-foreground mt-1">This job is now in your My Jobs list.</p>
        </div>
      )}

      {isDeclined && (
        <div className="metric-card border-destructive/30 bg-destructive/5 text-center py-6">
          <p className="text-lg font-semibold text-destructive">Job Declined</p>
          <p className="text-sm text-muted-foreground mt-1">Reason: {myOffer?.decline_reason}</p>
        </div>
      )}

      {isExpired && (
        <div className="metric-card border-warning/30 bg-warning/5 text-center py-6">
          <p className="text-lg font-semibold text-warning">Offer Expired</p>
          <p className="text-sm text-muted-foreground mt-1">This offer is no longer available.</p>
        </div>
      )}
    </div>
  );
}
