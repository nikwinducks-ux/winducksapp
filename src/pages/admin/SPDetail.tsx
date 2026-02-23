import { useParams, Link } from "react-router-dom";
import { useServiceProvider, useJobs, useToggleSPStatus } from "@/hooks/useSupabaseData";
import { formatAddress } from "@/data/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreBar } from "@/components/ScoreBar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Pencil } from "lucide-react";
import SPLoginAccess from "@/components/admin/SPLoginAccess";
import SPAvailabilityEditor from "@/components/admin/SPAvailabilityEditor";

export default function SPDetail() {
  const { id } = useParams();
  const { data: sp, isLoading } = useServiceProvider(id);
  const { data: jobs = [] } = useJobs();
  const toggleStatus = useToggleSPStatus();

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
              <StatusBadge label={sp.complianceStatus} variant={sp.complianceStatus === "Valid" ? "valid" : sp.complianceStatus === "Expiring" ? "warning" : "error"} />
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

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="competency">Competency</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="login">Login & Access</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
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
          <div className="metric-card space-y-4 mt-4">
            <h2 className="section-title">Compliance Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground mb-1">Insurance Expiry</p><p className="text-sm font-medium">{sp.insuranceExpiry}</p></div>
              <div><p className="text-xs text-muted-foreground mb-1">Compliance Status</p><StatusBadge label={sp.complianceStatus} variant={sp.complianceStatus === "Valid" ? "valid" : sp.complianceStatus === "Expiring" ? "warning" : "error"} /></div>
            </div>
          </div>
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

        <TabsContent value="login">
          <SPLoginAccess spId={sp.id} spName={sp.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
