import { useParams, Link } from "react-router-dom";
import { useServiceProviders, useJobs } from "@/hooks/useSupabaseData";
import { declineReasons } from "@/data/mockData";
import { ScoreBar } from "@/components/ScoreBar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, MapPin, Clock, Calendar, DollarSign, User, AlertCircle, Info } from "lucide-react";
import { useState, useMemo } from "react";
import { haversineDistance, proximityScore, PROXIMITY_TOOLTIP } from "@/lib/proximity";

export default function JobOfferDetail() {
  const { id } = useParams();
  const { data: serviceProviders = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();
  const job = jobs.find((j) => j.id === id);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  const currentSp = serviceProviders[0];

  const distanceInfo = useMemo(() => {
    if (!job || !currentSp) return { distance: null, needsGeocoding: true, score: 0 };
    const spAddr = currentSp.baseAddress;
    const jobAddr = job.jobAddress;
    if (spAddr.lat && spAddr.lng && jobAddr.lat && jobAddr.lng) {
      const d = haversineDistance(spAddr.lat, spAddr.lng, jobAddr.lat, jobAddr.lng);
      return { distance: d, needsGeocoding: false, score: proximityScore(d) };
    }
    return { distance: null, needsGeocoding: true, score: job.scores?.proximity ?? 0 };
  }, [job, currentSp]);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Job not found</p>
        <Link to="/jobs" className="text-primary hover:underline mt-2 text-sm">Back to Jobs</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Job Offers
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="page-header">{job.id}</h1>
          <span className={`status-badge ${job.status === "pending" || job.status === "created" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
            {accepted ? "Accepted" : declined ? "Declined" : job.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Offer expires in 45:00 minutes</p>
      </div>

      <div className="metric-card space-y-4">
        <h2 className="section-title">Job Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{job.customerName}</p></div></div>
          <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Address</p><p className="font-medium">{job.address}</p></div></div>
          <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Schedule</p><p className="font-medium">{job.scheduledDate} · {job.scheduledTime}</p></div></div>
          <div className="flex items-center gap-3"><Clock className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Duration</p><p className="font-medium">{job.estimatedDuration}</p></div></div>
          <div className="flex items-center gap-3"><DollarSign className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Payout</p><p className="text-xl font-bold text-primary">${job.payout}</p></div></div>
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Distance from you</p>
              {distanceInfo.distance !== null ? (
                <p className="font-medium">{distanceInfo.distance} km</p>
              ) : (
                <span className="status-badge bg-warning/10 text-warning">Needs geocoding</span>
              )}
            </div>
          </div>
        </div>
      </div>

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

      {(job.status === "pending" || job.status === "created") && !accepted && !declined && (
        <div className="metric-card space-y-4">
          <h2 className="section-title">Actions</h2>
          {!showDecline ? (
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => setAccepted(true)}>Accept Job</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowDecline(true)}>Decline Job</Button>
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
                <Button variant="destructive" disabled={!declineReason} onClick={() => setDeclined(true)} className="flex-1">Confirm Decline</Button>
                <Button variant="outline" onClick={() => setShowDecline(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {accepted && (
        <div className="metric-card border-success/30 bg-success/5 text-center py-6">
          <p className="text-lg font-semibold text-success">✓ Job Accepted Successfully</p>
          <p className="text-sm text-muted-foreground mt-1">You'll receive confirmation details shortly.</p>
        </div>
      )}

      {declined && (
        <div className="metric-card border-destructive/30 bg-destructive/5 text-center py-6">
          <p className="text-lg font-semibold text-destructive">Job Declined</p>
          <p className="text-sm text-muted-foreground mt-1">Reason: {declineReason}</p>
        </div>
      )}
    </div>
  );
}
