import { useParams, Link, useSearchParams } from "react-router-dom";
import { JobServicesDisplay } from "@/components/JobServicesDisplay";
import { useJobs, useServiceProviders, useAssignJob, useActiveServiceCategories, useServiceCategories } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { useOffers, useCreateManualOffer, useGenerateBroadcastOffers } from "@/hooks/useOfferData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { ArrowLeft, MapPin, Calendar, Clock, DollarSign, User, Pencil, UserPlus, AlertCircle, FileText, Send, Radio } from "lucide-react";
import { useState } from "react";

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
  const createManualOffer = useCreateManualOffer();
  const generateBroadcast = useGenerateBroadcastOffers();

  const job = jobs.find((j) => j.dbId === id);
  const [showAssign, setShowAssign] = useState(searchParams.get("assign") === "true");
  const [selectedSpId, setSelectedSpId] = useState("");
  const [showSendOffer, setShowSendOffer] = useState(false);
  const [offerSpId, setOfferSpId] = useState("");
  const [offerExpiry, setOfferExpiry] = useState(10);
  const [broadcastExpiry, setBroadcastExpiry] = useState(30);

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

  const handleSendOffer = async () => {
    if (!offerSpId || !id) return;
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
          </div>
        </div>

        {/* Services */}
        {job.services && job.services.length > 0 && (
          <div className="metric-card space-y-3">
            <h2 className="section-title">Services ({job.services.length})</h2>
            <JobServicesDisplay services={job.services} categories={allCategories} />
          </div>
        )}

        {/* Legacy single service display */}
        {(!job.services || job.services.length === 0) && job.serviceCategory && (
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

      {/* Offers panel */}
      <div className="metric-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Offers</h2>
          <div className="flex gap-2">
            {job.isBroadcast && (
              <Button size="sm" variant="outline" onClick={async () => {
                await generateBroadcast.mutateAsync({
                  job,
                  serviceProviders: providers,
                  expiryMinutes: broadcastExpiry,
                  createdBy: user?.id ?? "system",
                });
                refetchOffers();
              }} disabled={generateBroadcast.isPending}>
                <Radio className="h-4 w-4 mr-1" />{generateBroadcast.isPending ? "Broadcasting..." : "Broadcast Offers"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowSendOffer(!showSendOffer)}>
              <Send className="h-4 w-4 mr-1" />Send Offer to SP
            </Button>
          </div>
        </div>

        {showSendOffer && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Service Provider</Label>
                <Select value={offerSpId} onValueChange={setOfferSpId}>
                  <SelectTrigger><SelectValue placeholder="Select an SP..." /></SelectTrigger>
                  <SelectContent>
                    {providers.filter(sp => sp.status === "Active").map(sp => (
                      <SelectItem key={sp.id} value={sp.id}>
                        {sp.name} — {sp.baseAddress.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Expiry (minutes)</Label>
                <Input type="number" min={1} max={60} value={offerExpiry} onChange={e => setOfferExpiry(parseInt(e.target.value) || 10)} className="w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSendOffer} disabled={!offerSpId || createManualOffer.isPending}>
                {createManualOffer.isPending ? "Sending..." : "Send Offer"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowSendOffer(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {jobOffers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No offers sent for this job yet.</p>
        ) : (
          <div className="space-y-2">
            {jobOffers.map(offer => {
              const sp = providers.find(s => s.id === offer.sp_id);
              const isExpired = offer.status === "Pending" && new Date(offer.expires_at) < new Date();
              return (
                <div key={offer.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{sp?.name ?? offer.sp_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {offer.acceptance_source === "AutoAccept" && "⚡ Auto-accepted • "}
                      {offer.acceptance_source === "Broadcast" && "📡 Broadcast • "}
                      Offered {new Date(offer.offered_at).toLocaleString()}
                      {offer.expires_at && ` • Expires ${new Date(offer.expires_at).toLocaleTimeString()}`}
                      {offer.decline_reason && ` • Reason: ${offer.decline_reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {offer.acceptance_source === "Broadcast" && <StatusBadge label="Broadcast" variant="warning" />}
                    <StatusBadge label={isExpired ? "Expired" : offer.status} variant={offerVariant(isExpired ? "Expired" : offer.status) as any} />
                  </div>
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
