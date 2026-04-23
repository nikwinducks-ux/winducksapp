import { useParams, Link } from "react-router-dom";
import { JobServicesDisplay } from "@/components/JobServicesDisplay";
import { useJobs, useServiceProviders, useActiveServiceCategories, useUpdateJobStatus, useServiceCategories, useJobCrew } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Clock, Calendar, DollarSign, User, AlertCircle, FileText, Briefcase, Users, Star } from "lucide-react";
import { useMemo } from "react";
import { computeProximityResult, DISTANCE_SOURCE_LABELS } from "@/lib/proximity";
import { JobPhotosCard } from "@/components/JobPhotosCard";

import { UrgencyBadge } from "@/components/UrgencyBadge";

function ScheduleDisplay({ job }: { job: any }) {
  const urgency = job.urgency || "Scheduled";
  if (urgency === "ASAP") return <p className="font-medium">ASAP — dispatch as soon as possible</p>;
  if (urgency === "AnytimeSoon") return <p className="font-medium">Anytime soon — flexible timing</p>;
  return <p className="font-medium">{job.scheduledDate || "Not scheduled"} {job.scheduledTime && `· ${job.scheduledTime}`}</p>;
}

const statusVariant = (s: string) => {
  switch (s) {
    case "Assigned": case "Accepted": return "info";
    case "InProgress": return "warning";
    case "Completed": return "valid";
    case "Cancelled": return "error";
    default: return "neutral";
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case "InProgress": return "In Progress";
    default: return s;
  }
};

export default function SPJobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useJobs();
  const { data: providers = [] } = useServiceProviders();
  const activeCategories = useActiveServiceCategories();
  const { data: allCategories = [] } = useServiceCategories();
  const updateStatus = useUpdateJobStatus();

  const job = jobs.find((j) => j.dbId === id || j.id === id);
  const { data: crew = [] } = useJobCrew(job?.dbId);
  const currentSp = providers.find((sp) => sp.id === user?.spId);
  const isLegacy = job && activeCategories.length > 0 && !activeCategories.some((c) => c.name === job.serviceCategory);

  const distanceInfo = useMemo(() => {
    if (!job || !currentSp) return null;
    return computeProximityResult(currentSp.baseAddress, job.jobAddress);
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

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Job not found</p>
        <Link to="/my-jobs" className="text-primary hover:underline mt-2 text-sm">Back to My Jobs</Link>
      </div>
    );
  }

  const isCrewMember = crew.some((c) => c.spId === user.spId);
  const isMyJob = job.assignedSpId === user.spId || isCrewMember;
  const canMarkInProgress = isMyJob && ["Assigned", "Accepted"].includes(job.status);
  const canMarkCompleted = isMyJob && ["Assigned", "Accepted", "InProgress"].includes(job.status);
  const isCrew = crew.length > 1;
  const myShare = isCrew ? Math.round((job.payout / crew.length) * 100) / 100 : job.payout;

  const handleStatusUpdate = (newStatus: string) => {
    updateStatus.mutate({
      jobDbId: job.dbId,
      oldStatus: job.status,
      newStatus,
      spId: user.spId!,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <Link to="/my-jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to My Jobs
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="page-header">{job.id}</h1>
        <StatusBadge label={statusLabel(job.status)} variant={statusVariant(job.status) as any} />
        <UrgencyBadge urgency={job.urgency} />
      </div>

      {/* Job Details */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Job Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{job.customerName}</p></div>
          </div>
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
          {distanceInfo !== null && distanceInfo.distanceKm !== null && (
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="font-medium">{distanceInfo.distanceKm} km</p>
                <p className="text-xs text-muted-foreground">Source: {DISTANCE_SOURCE_LABELS[distanceInfo.source]}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Services */}
      {job.services && job.services.length > 0 && (
        <div className="metric-card space-y-3">
          <h2 className="section-title">Services ({job.services.length})</h2>
          <JobServicesDisplay services={job.services} categories={allCategories} />
        </div>
      )}

      {/* Legacy single service */}
      {(!job.services || job.services.length === 0) && job.serviceCategory && (
        <div className="metric-card space-y-3">
          <h2 className="section-title">Service</h2>
          <p className="font-medium">{isLegacy ? `(Legacy) ${job.serviceCategory}` : job.serviceCategory}</p>
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

      {/* Status Update Actions */}
      {isMyJob && (canMarkInProgress || canMarkCompleted) && (
        <div className="metric-card space-y-4">
          <h2 className="section-title">Update Status</h2>
          <div className="flex gap-3">
            {canMarkInProgress && (
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate("InProgress")}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending ? "Updating..." : "Mark In Progress"}
              </Button>
            )}
            {canMarkCompleted && (
              <Button
                onClick={() => handleStatusUpdate("Completed")}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending ? "Updating..." : "Mark Completed"}
              </Button>
            )}
          </div>
        </div>
      )}

      {job.status === "Completed" && (
        <div className="metric-card border-success/30 bg-success/5 text-center py-6">
          <p className="text-lg font-semibold text-success">✓ Job Completed</p>
        </div>
      )}
    </div>
  );
}
