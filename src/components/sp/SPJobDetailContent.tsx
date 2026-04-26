import { useMemo } from "react";
import {
  MapPin, Clock, Calendar, DollarSign, User, FileText, Users, Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { JobServicesDisplay } from "@/components/JobServicesDisplay";
import { JobPhotosCard } from "@/components/JobPhotosCard";
import { CrewTeammates } from "@/components/sp/CrewTeammates";
import { JobVisitsCard } from "@/components/sp/JobVisitsCard";
import {
  useServiceProviders,
  useActiveServiceCategories,
  useServiceCategories,
  useJobCrew,
} from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { computeProximityResult, DISTANCE_SOURCE_LABELS } from "@/lib/proximity";
import { openInMaps } from "@/lib/geolocation";
import type { Job } from "@/data/mockData";

function ScheduleDisplay({ job }: { job: Job }) {
  const urgency = job.urgency || "Scheduled";
  if (urgency === "ASAP") return <p className="font-medium">ASAP — dispatch as soon as possible</p>;
  if (urgency === "AnytimeSoon") return <p className="font-medium">Anytime soon — flexible timing</p>;
  return (
    <p className="font-medium">
      {job.scheduledDate || "Not scheduled"} {job.scheduledTime && `· ${job.scheduledTime}`}
    </p>
  );
}

const statusVariant = (s: string) => {
  switch (s) {
    case "Assigned":
    case "Accepted":
      return "info";
    case "InProgress":
      return "warning";
    case "Completed":
      return "valid";
    case "Cancelled":
      return "error";
    default:
      return "neutral";
  }
};

const statusLabel = (s: string) => (s === "InProgress" ? "In Progress" : s);

interface Props {
  job: Job;
  /**
   * `page` keeps the original sticky bottom CTA on mobile (used by the
   * full /sp/jobs/:id route). `panel` renders status actions inline at the
   * top of the body so they remain tappable inside a side sheet.
   */
  variant?: "page" | "panel";
  /** Hide the title row (id + status + urgency) when the parent already renders it. */
  hideHeader?: boolean;
}

export function SPJobDetailContent({ job, variant = "page", hideHeader = false }: Props) {
  const { user } = useAuth();
  const { data: providers = [] } = useServiceProviders();
  const activeCategories = useActiveServiceCategories();
  const { data: allCategories = [] } = useServiceCategories();
  const updateStatus = useUpdateJobStatus();
  const { data: crew = [] } = useJobCrew(job.dbId);

  const currentSp = providers.find((sp) => sp.id === user?.spId);
  const isLegacy = activeCategories.length > 0 && !activeCategories.some((c) => c.name === job.serviceCategory);

  const distanceInfo = useMemo(() => {
    if (!currentSp) return null;
    return computeProximityResult(currentSp.baseAddress, job.jobAddress);
  }, [job, currentSp]);

  const isCrewMember = crew.some((c) => c.spId === user?.spId);
  const isMyJob = job.assignedSpId === user?.spId || isCrewMember;
  const canMarkInProgress = isMyJob && ["Assigned", "Accepted"].includes(job.status);
  const canMarkCompleted = isMyJob && ["Assigned", "Accepted", "InProgress"].includes(job.status);
  const isCrew = crew.length > 1;
  const myShare = isCrew ? Math.round((job.payout / crew.length) * 100) / 100 : job.payout;

  const handleStatusUpdate = (newStatus: string) => {
    if (!user?.spId) return;
    updateStatus.mutate({
      jobDbId: job.dbId,
      oldStatus: job.status,
      newStatus,
      spId: user.spId,
    });
  };

  const inlineStatusActions =
    isMyJob && (canMarkInProgress || canMarkCompleted) ? (
      <div className="metric-card space-y-3">
        <h2 className="section-title">Update Status</h2>
        <div className="flex gap-2">
          {canMarkInProgress && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleStatusUpdate("InProgress")}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? "Updating..." : "Mark In Progress"}
            </Button>
          )}
          {canMarkCompleted && (
            <Button
              className="flex-1"
              onClick={() => handleStatusUpdate("Completed")}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? "Updating..." : "Mark Completed"}
            </Button>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="page-header">{job.id}</h1>
          <StatusBadge label={statusLabel(job.status)} variant={statusVariant(job.status) as any} />
          <UrgencyBadge urgency={job.urgency} />
        </div>
      )}

      {/* In panel mode, surface status actions near the top */}
      {variant === "panel" && inlineStatusActions}

      {/* Job Details */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Job Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium">{job.customerName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="font-medium break-words">{job.address}</p>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-primary"
                onClick={() => openInMaps(job.address)}
              >
                <Navigation className="mr-1 h-3 w-3" /> Open in Maps
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Schedule</p>
              <ScheduleDisplay job={job} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium">{job.estimatedDuration || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Payout</p>
              <p className="text-xl font-bold text-primary">${myShare.toFixed(2)}</p>
              {isCrew && (
                <p className="text-xs text-muted-foreground">
                  Your share of ${job.payout} (÷ {crew.length})
                </p>
              )}
            </div>
          </div>
          {distanceInfo !== null && distanceInfo.distanceKm !== null && (
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="font-medium">{distanceInfo.distanceKm} km</p>
                <p className="text-xs text-muted-foreground">
                  Source: {DISTANCE_SOURCE_LABELS[distanceInfo.source]}
                </p>
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
          <p className="font-medium">
            {isLegacy ? `(Legacy) ${job.serviceCategory}` : job.serviceCategory}
          </p>
        </div>
      )}

      {/* Notes */}
      {job.notes && (
        <div className="metric-card space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <FileText className="h-4 w-4" />Job Notes
          </h2>
          <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      {/* Crew */}
      {crew.length > 1 && (
        <div className="metric-card space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <Users className="h-4 w-4" />Crew ({crew.length})
          </h2>
          <CrewTeammates jobId={job.dbId} excludeSpId={user?.spId} variant="card" showPhone hideWhenEmpty={false} />
          <p className="text-xs text-muted-foreground">You are also on this crew.</p>
        </div>
      )}

      {/* Photos */}
      <JobPhotosCard jobId={job.dbId} />

      {/* Page-mode status actions: inline (desktop) + sticky bottom (mobile) */}
      {variant === "page" && isMyJob && (canMarkInProgress || canMarkCompleted) && (
        <>
          <div className="metric-card space-y-4 hidden lg:block">
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

          {/* Mobile sticky bottom CTA — sits above the bottom tab bar */}
          <div
            className="fixed inset-x-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 lg:hidden"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 56px)" }}
          >
            <div className="mx-auto flex max-w-3xl gap-2">
              {canMarkInProgress && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => handleStatusUpdate("InProgress")}
                  disabled={updateStatus.isPending}
                >
                  {updateStatus.isPending ? "..." : "In Progress"}
                </Button>
              )}
              {canMarkCompleted && (
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => handleStatusUpdate("Completed")}
                  disabled={updateStatus.isPending}
                >
                  {updateStatus.isPending ? "..." : "Mark Completed"}
                </Button>
              )}
            </div>
          </div>
          {/* Spacer so content isn't hidden behind sticky bar on mobile */}
          <div className="h-20 lg:hidden" aria-hidden />
        </>
      )}

      {job.status === "Completed" && (
        <div className="metric-card border-success/30 bg-success/5 text-center py-6">
          <p className="text-lg font-semibold text-success">✓ Job Completed</p>
        </div>
      )}
    </div>
  );
}

export default SPJobDetailContent;
