import { useParams, Link } from "react-router-dom";
import { useServiceProvider, useJobs, useToggleSPStatus, useUpdateSPColor, useSPComplianceDocs } from "@/hooks/useSupabaseData";
import { formatAddress } from "@/data/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { ScoreBar } from "@/components/ScoreBar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Pencil, Eye } from "lucide-react";
import SPLoginAccess from "@/components/admin/SPLoginAccess";
import SPAvailabilityEditor from "@/components/admin/SPAvailabilityEditor";
import SPReviewsTab from "@/components/admin/SPReviewsTab";
import SPComplianceDocuments from "@/components/admin/SPComplianceDocuments";
import { SPColorPicker } from "@/components/admin/SPColorPicker";
import { PALETTE_LABELS, type PaletteKey } from "@/components/calendar/spColors";
import { complianceStateForDate, complianceLabel, complianceBadgeVariant, worstComplianceState } from "@/lib/compliance";
import { toast } from "sonner";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const jobStatusVariant = (s: string) => {
  switch (s) {
    case "Assigned": case "Accepted": return "info";
    case "InProgress": return "warning";
    case "Completed": return "valid";
    case "Cancelled": case "Expired": return "warning";
    default: return "neutral";
  }
};

const jobStatusLabel = (s: string) => s === "InProgress" ? "In Progress" : s;

function SPJobsTab({ jobs }: { jobs: any[] }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = statusFilter === "all" ? jobs : jobs.filter((j: any) => j.status === statusFilter);

  return (
    <div className="metric-card space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Assigned Jobs</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Assigned">Assigned</SelectItem>
            <SelectItem value="InProgress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No jobs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium text-muted-foreground">Job #</th>
                <th className="pb-3 font-medium text-muted-foreground">Customer</th>
                <th className="pb-3 font-medium text-muted-foreground">Urgency</th>
                <th className="pb-3 font-medium text-muted-foreground">Status</th>
                <th className="pb-3 font-medium text-muted-foreground">Scheduled</th>
                <th className="pb-3 font-medium text-muted-foreground">Amount</th>
                <th className="pb-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job: any) => (
                <tr key={job.dbId} className="border-b last:border-0">
                  <td className="py-3 font-medium">{job.id}</td>
                  <td className="py-3">{job.customerName}</td>
                  <td className="py-3"><UrgencyBadge urgency={job.urgency} /></td>
                  <td className="py-3"><StatusBadge label={jobStatusLabel(job.status)} variant={jobStatusVariant(job.status) as any} /></td>
                  <td className="py-3 text-muted-foreground">{job.scheduledDate || "—"}</td>
                  <td className="py-3 font-medium">${job.payout}</td>
                  <td className="py-3">
                    <Link to={`/admin/jobs/${job.dbId}`}>
                      <Button size="sm" variant="ghost" title="View"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SPDetail() {
  const { id } = useParams();
  const { data: sp, isLoading } = useServiceProvider(id);
  const { data: jobs = [] } = useJobs();
  const { data: complianceDocs = [] } = useSPComplianceDocs(id);
  const toggleStatus = useToggleSPStatus();
  const updateColor = useUpdateSPColor();
  const [activeTab, setActiveTab] = useState("profile");

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  if (!sp) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Service Provider not found</p>
        <Link to="/admin/providers" className="text-primary hover:underline mt-2 text-sm">Back to Providers</Link>
      </div>
    );
  }

  const suspended = sp.status === "Suspended";
  const spJobs = jobs.filter((j) => j.assignedSpId === sp.id);

  // Roll up overall compliance from documents
  const docStates = complianceDocs.map((d) => complianceStateForDate(d.expiresOn));
  const overallCompliance = worstComplianceState(docStates);
  const overallLabel = complianceDocs.length === 0 ? "No documents" : complianceLabel(overallCompliance);
  const overallVariant = complianceDocs.length === 0 ? "neutral" : complianceBadgeVariant(overallCompliance);

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/admin/providers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Providers
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
            {sp.avatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-header">{sp.name}</h1>
              <StatusBadge label={sp.status} variant={suspended ? "error" : "valid"} />
              <button
                type="button"
                onClick={() => setActiveTab("compliance")}
                className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity hover:opacity-80"
                title="View compliance documents"
              >
                <StatusBadge label={overallLabel} variant={overallVariant as any} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">{sp.email} · {sp.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">Suspended</span>
            <Switch
              checked={suspended}
              onCheckedChange={(checked) => toggleStatus.mutate({ id: sp.id, status: checked ? "Suspended" : "Active" })}
            />
          </div>
          <Link to={`/admin/providers/${sp.id}/edit`}>
            <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-2" />Edit</Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="w-max">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="jobs">Jobs ({spJobs.length})</TabsTrigger>
            <TabsTrigger value="competency">Competency</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="login">Login & Access</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile">
          <div className="metric-card space-y-3 mt-4">
            <h2 className="section-title">Calendar Color</h2>
            <p className="text-xs text-muted-foreground">Choose how this provider appears on the admin calendar. "Auto" uses an automatically assigned color.</p>
            <SPColorPicker
              value={sp.calendarColor ?? null}
              disabled={updateColor.isPending}
              onChange={(key) => {
                updateColor.mutate(
                  { id: sp.id, color: key },
                  {
                    onSuccess: () => {
                      toast.success(
                        key
                          ? `Color updated. ${sp.name} will now appear in ${PALETTE_LABELS[key as PaletteKey]} on the calendar.`
                          : `Color reset. ${sp.name} will use the auto-assigned color.`
                      );
                    },
                    onError: (err: any) => toast.error(err?.message ?? "Failed to update color"),
                  }
                );
              }}
            />
          </div>
          <div className="metric-card space-y-4 mt-4">
            <h2 className="section-title">Base Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground mb-1">Street</p><p className="text-sm font-medium">{sp.baseAddress.street}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">City</p><p className="text-sm font-medium">{sp.baseAddress.city}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Province</p><p className="text-sm font-medium">{sp.baseAddress.province}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Postal Code</p><p className="text-sm font-medium">{sp.baseAddress.postalCode}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Coordinates</p><p className="text-sm font-medium">{sp.baseAddress.lat && sp.baseAddress.lng ? `${sp.baseAddress.lat}, ${sp.baseAddress.lng}` : "Not set"}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Full Address</p><p className="text-sm font-medium flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{formatAddress(sp.baseAddress)}</p></div>
            </div>
            <div className="border-t pt-4 grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground mb-1">Service Radius</p><p className="text-sm font-medium">{sp.travelRadius} km</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Max Jobs / Day</p><p className="text-sm font-medium">{sp.maxJobsPerDay}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Joined</p><p className="text-sm font-medium">{sp.joinedDate}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="text-sm font-medium">{sp.notes || "—"}</p></div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          <SPJobsTab jobs={spJobs} />
        </TabsContent>

        <TabsContent value="competency">
          <div className="metric-card space-y-4 mt-4">
            <h2 className="section-title">Service Categories</h2>
            <div className="flex flex-wrap gap-2">
              {sp.serviceCategories.map((c) => (<span key={c} className="status-badge bg-primary/10 text-primary">{c}</span>))}
            </div>
            <div className="border-t pt-4">
              <h2 className="section-title mb-3">Certifications</h2>
              <div className="flex flex-wrap gap-2">
                {sp.certifications.map((c) => (<span key={c} className="status-badge bg-secondary text-secondary-foreground">{c}</span>))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="availability">
          <SPAvailabilityEditor spId={sp.id} />
        </TabsContent>

        <TabsContent value="compliance">
          <SPComplianceDocuments spId={sp.id} />
        </TabsContent>

        <TabsContent value="performance">
          <div className="metric-card space-y-4 mt-4">
            <h2 className="section-title">Performance Metrics</h2>
            <div className="space-y-3">
              <ScoreBar label="Reliability" value={sp.reliabilityScore} />
              <ScoreBar label="Completion Rate" value={sp.completionRate} />
              <ScoreBar label="On-Time Rate" value={sp.onTimeRate} />
              <ScoreBar label="Acceptance Rate" value={sp.acceptanceRate} />
            </div>
            <div className="border-t pt-4 grid gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground mb-1">Rating</p><p className="text-lg font-bold">⭐ {sp.rating}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Total Jobs</p><p className="text-lg font-bold">{sp.totalJobsCompleted}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Avg Response</p><p className="text-lg font-bold">{sp.avgResponseTime}</p></div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reviews">
          <SPReviewsTab spId={sp.id} />
        </TabsContent>

        <TabsContent value="login">
          <SPLoginAccess spId={sp.id} spName={sp.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
