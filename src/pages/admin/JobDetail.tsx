import { useParams, Link, useSearchParams } from "react-router-dom";
import { useJobs, useServiceProviders, useAssignJob, useActiveServiceCategories } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, MapPin, Calendar, Clock, DollarSign, User, Pencil, UserPlus, AlertCircle, FileText } from "lucide-react";
import { useState } from "react";

function UrgencyBadge({ urgency }: { urgency?: string }) {
  if (!urgency || urgency === "Scheduled") return <StatusBadge label="Scheduled" variant="info" />;
  if (urgency === "ASAP") return <StatusBadge label="ASAP" variant="error" />;
  return <StatusBadge label="Anytime soon" variant="warning" />;
}

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

  const job = jobs.find((j) => j.dbId === id);
  const [showAssign, setShowAssign] = useState(searchParams.get("assign") === "true");
  const [selectedSpId, setSelectedSpId] = useState("");

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

  const handleAssign = () => {
    if (!selectedSpId || !id) return;
    assignJob.mutate(
      { jobId: job!.dbId, spId: selectedSpId, assignedByUserId: user?.id ?? null },
      { onSuccess: () => setShowAssign(false) }
    );
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "assigned": return "info";
      case "completed": return "valid";
      case "cancelled": return "warning";
      default: return "neutral";
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
          <StatusBadge label={job.status} variant={statusVariant(job.status) as any} />
          <UrgencyBadge urgency={job.urgency} />
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/jobs/${job.dbId}/edit`}>
            <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />Edit</Button>
          </Link>
          <Button size="sm" onClick={() => setShowAssign(true)}>
            <UserPlus className="h-4 w-4 mr-1" />Assign SP
          </Button>
        </div>
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
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Service Category</p>
              <p className="font-medium">{isLegacyCategory ? `(Legacy) ${job.serviceCategory}` : job.serviceCategory}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {job.notes && (
        <div className="metric-card space-y-3">
          <h2 className="section-title flex items-center gap-2"><FileText className="h-4 w-4" />Job Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

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

        {showAssign && (
          <div className="border-t pt-4 space-y-3">
            <label className="text-sm font-medium">Select Service Provider</label>
            <Select value={selectedSpId} onValueChange={setSelectedSpId}>
              <SelectTrigger><SelectValue placeholder="Choose an SP..." /></SelectTrigger>
              <SelectContent>
                {providers.filter((sp) => sp.status === "Active").map((sp) => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.name} — {sp.baseAddress.city} · {sp.travelRadius}km · {sp.complianceStatus}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={handleAssign} disabled={!selectedSpId || assignJob.isPending}>
                {assignJob.isPending ? "Assigning..." : "Assign"}
              </Button>
              <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
