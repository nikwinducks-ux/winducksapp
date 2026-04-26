import { useState, useEffect } from "react";
import { formatCAD } from "@/lib/currency";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCustomers, useCreateJob, useUpdateJob, useActiveServiceCategories, useJobServices, useSaveJobServices, useJobPhotos, useSaveJobPhotos, useJobCrew, useAssignCrew, useServiceProviders } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { JobPhotosUploader, type JobPhotosUploaderState } from "@/components/JobPhotosUploader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Info, MapPin, Plus, Radio, Users } from "lucide-react";
import { QuickCustomerDialog } from "@/components/admin/QuickCustomerDialog";
import { autofillCoords, SUPPORTED_CITIES } from "@/lib/coord-autofill";
import { useToast } from "@/hooks/use-toast";
import { normalizeUrgency } from "@/components/UrgencyBadge";
import { JobServiceLineItems, type ServiceLineItem } from "@/components/JobServiceLineItems";
import { CrewPicker, type CrewPickerValue } from "@/components/admin/CrewPicker";

// Generate time options in 15-min increments
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    const hh = h.toString().padStart(2, "0");
    const mm = m.toString().padStart(2, "0");
    TIME_OPTIONS.push(`${hh}:${mm}`);
  }
}

// Generate duration options in 15-min increments (15 min to 8 hours)
const DURATION_OPTIONS: { value: string; label: string }[] = [];
for (let mins = 15; mins <= 480; mins += 15) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  DURATION_OPTIONS.push({ value: String(mins), label });
}

function formatTime12h(t: string): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mm} ${ampm}`;
}

function parseDurationToMinutes(val: string): string {
  if (!val) return "";
  const num = parseFloat(val);
  if (!isNaN(num) && val.toLowerCase().includes("hour")) return String(Math.round(num * 60));
  if (!isNaN(num) && num > 0 && num <= 24) return String(Math.round(num * 60));
  if (!isNaN(num) && num >= 15) return String(num);
  return "";
}

const URGENCY_OPTIONS = [
  { value: "Scheduled", label: "Scheduled", helper: "" },
  { value: "ASAP", label: "ASAP", helper: "Dispatch as soon as an SP is available." },
  { value: "AnytimeSoon", label: "Anytime soon", helper: "Flexible timing; assign when available." },
];

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEdit = !!id;
  const { data: customers = [] } = useCustomers();
  const { data: providers = [] } = useServiceProviders();
  const activeCategories = useActiveServiceCategories();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const saveJobServices = useSaveJobServices();
  const { data: existingServices = [] } = useJobServices(id);
  const savePhotos = useSaveJobPhotos();
  const { data: existingPhotos = [] } = useJobPhotos(id);
  const { data: existingCrew = [] } = useJobCrew(id);
  const assignCrew = useAssignCrew();
  const [photoState, setPhotoState] = useState<JobPhotosUploaderState>({
    newFiles: [], newCaptions: [], keepIds: [], updatedCaptions: {},
  });
  const [crewMembers, setCrewMembers] = useState<CrewPickerValue[]>([]);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);

  const [form, setForm] = useState({
    customerId: "",
    customerPropertyId: "",
    payout: "",
    street: "",
    city: "",
    province: "AB",
    postalCode: "",
    country: "Canada",
    lat: "",
    lng: "",
    scheduledDate: "",
    scheduledTime: "",
    estimatedDurationMinutes: "",
    notes: "",
    urgency: "Scheduled",
    isBroadcast: false,
    broadcastRadiusKm: "100",
    broadcastNote: "",
  });

  const [serviceItems, setServiceItems] = useState<ServiceLineItem[]>([
    { service_category: "", quantity: 1, unit_price: "", notes: "" },
  ]);

  const [loadingExisting, setLoadingExisting] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
      if (data) {
        setForm({
          customerId: data.customer_id ?? "",
          customerPropertyId: (data as any).customer_property_id ?? "",
          payout: String(data.payout),
          street: data.job_address_street,
          city: data.job_address_city,
          province: data.job_address_region,
          postalCode: data.job_address_postal,
          country: data.job_address_country,
          lat: data.job_lat?.toString() ?? "",
          lng: data.job_lng?.toString() ?? "",
          scheduledDate: data.scheduled_date ?? "",
          scheduledTime: data.scheduled_time ?? "",
          estimatedDurationMinutes: parseDurationToMinutes(data.estimated_duration) || data.estimated_duration || "",
          notes: (data as any).notes ?? "",
          urgency: (data as any).urgency ?? "Scheduled",
          isBroadcast: (data as any).is_broadcast ?? false,
          broadcastRadiusKm: String((data as any).broadcast_radius_km ?? 100),
          broadcastNote: (data as any).broadcast_note ?? "",
        });
      }
      setLoadingExisting(false);
    })();
  }, [id, isEdit]);

  // Initialize service items from existing services when editing
  useEffect(() => {
    if (isEdit && existingServices.length > 0) {
      setServiceItems(existingServices.map(s => ({
        service_category: s.service_category,
        quantity: s.quantity,
        unit_price: s.unit_price != null ? String(s.unit_price) : "",
        notes: s.notes,
      })));
    }
  }, [isEdit, existingServices.length]);

  // Prefill crew from existing crew when editing
  useEffect(() => {
    if (isEdit && existingCrew.length > 0) {
      setCrewMembers(existingCrew.map(c => ({ spId: c.spId, isLead: c.isLead })));
    }
  }, [isEdit, existingCrew.length]);

  // Auto-fill address from selected property (or fall back to customer's primary/legacy address)
  useEffect(() => {
    if (isEdit) return;
    const cust = customers.find((c) => c.id === form.customerId);
    if (!cust) return;
    const props = cust.properties ?? [];
    let prop = props.find((p) => p.id === form.customerPropertyId);
    if (!prop) prop = props.find((p) => p.isPrimary) ?? props[0];
    const addr = prop ? prop.address : cust.serviceAddress;
    setForm((f) => ({
      ...f,
      customerPropertyId: prop?.id ?? "",
      street: addr.street,
      city: addr.city,
      province: addr.province,
      postalCode: addr.postalCode,
      country: addr.country,
      lat: addr.lat?.toString() ?? "",
      lng: addr.lng?.toString() ?? "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customerId, form.customerPropertyId, customers, isEdit]);

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });
  const isSaving = createJob.isPending || updateJob.isPending;

  const handleAutofillCoords = () => {
    const result = autofillCoords(form.city);
    if (result) {
      setForm((f) => ({ ...f, lat: String(result.lat), lng: String(result.lng) }));
      toast({ title: "Coordinates filled", description: `Approximate coords for ${form.city}` });
    } else {
      toast({ title: "City not supported", description: `Supported: ${SUPPORTED_CITIES.join(", ")}. Enter coordinates manually.`, variant: "destructive" });
    }
  };

  // Compute total from line items
  const computedTotal = serviceItems.reduce((sum, item) => {
    const price = parseFloat(item.unit_price);
    return sum + (isNaN(price) ? 0 : item.quantity * price);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Derive primary service category from first service item
    const primaryCategory = serviceItems[0]?.service_category || "";
    const mins = parseInt(form.estimatedDurationMinutes);
    const estimatedDuration = !isNaN(mins) && mins > 0
      ? (mins >= 60 ? `${Math.floor(mins / 60)}${mins % 60 > 0 ? `.${Math.round((mins % 60) / 60 * 10) / 10 * 10}` : ""} hours` : `${mins} minutes`)
      : form.estimatedDurationMinutes;

    // Use computed total if payout is empty, otherwise use manual payout
    const finalPayout = form.payout ? form.payout : String(computedTotal);

    const payload: any = {
      customerId: form.customerId,
      customerPropertyId: form.customerPropertyId,
      serviceCategory: primaryCategory,
      payout: finalPayout,
      street: form.street,
      city: form.city,
      province: form.province,
      postalCode: form.postalCode,
      country: form.country,
      lat: form.lat,
      lng: form.lng,
      scheduledDate: form.scheduledDate,
      scheduledTime: form.scheduledTime,
      estimatedDuration,
      notes: form.notes,
      urgency: normalizeUrgency(form.urgency),
      isBroadcast: form.isBroadcast,
      broadcastRadiusKm: parseInt(form.broadcastRadiusKm) || 100,
      broadcastNote: form.broadcastNote,
    };

    const servicesPayload = serviceItems
      .filter(s => s.service_category)
      .map(s => ({
        service_category: s.service_category,
        quantity: s.quantity,
        unit_price: s.unit_price ? parseFloat(s.unit_price) : null,
        line_total: s.unit_price ? s.quantity * parseFloat(s.unit_price) : 0,
        notes: s.notes,
      }));

    console.log("[JobForm] serviceItems count:", serviceItems.length, "filtered payload count:", servicesPayload.length, servicesPayload);

    if (isEdit && id) {
      updateJob.mutate({ id, ...payload }, {
        onSuccess: async () => {
          try {
            await saveJobServices.mutateAsync({ jobId: id, services: servicesPayload });
            await savePhotos.mutateAsync({
              jobId: id,
              newFiles: photoState.newFiles,
              newCaptions: photoState.newCaptions,
              keepIds: photoState.keepIds,
              existing: existingPhotos,
              updatedCaptions: photoState.updatedCaptions,
            });
            await assignCrew.mutateAsync({
              jobId: id,
              members: crewMembers,
              userId: user?.id ?? null,
            });
            navigate("/admin/jobs");
          } catch (err: any) {
            toast({ title: "Error saving job extras", description: err.message, variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Error updating job", description: err.message, variant: "destructive" });
        },
      });
    } else {
      // For create, we need the job ID from the insert
      try {
        const { data: newJob, error } = await supabase.from("jobs").insert({
          customer_id: payload.customerId || null,
          customer_property_id: payload.customerPropertyId || null,
          service_category: payload.serviceCategory,
          payout: parseFloat(payload.payout) || 0,
          job_address_street: payload.street,
          job_address_city: payload.city,
          job_address_region: payload.province,
          job_address_postal: payload.postalCode,
          job_address_country: payload.country,
          job_lat: payload.lat ? parseFloat(payload.lat) : null,
          job_lng: payload.lng ? parseFloat(payload.lng) : null,
          scheduled_date: payload.scheduledDate || null,
          scheduled_time: payload.scheduledTime,
          estimated_duration: payload.estimatedDuration,
          notes: payload.notes ?? "",
          urgency: payload.urgency ?? "Scheduled",
          is_broadcast: payload.isBroadcast ?? false,
          broadcast_radius_km: payload.broadcastRadiusKm ?? 100,
          broadcast_note: payload.broadcastNote ?? "",
          status: "Created",
        }).select("id").single();
        if (error) throw error;
        if (newJob && servicesPayload.length > 0) {
          console.log("[JobForm] Saving", servicesPayload.length, "services for new job", newJob.id);
          await saveJobServices.mutateAsync({ jobId: newJob.id, services: servicesPayload });
        }
        if (newJob && photoState.newFiles.length > 0) {
          await savePhotos.mutateAsync({
            jobId: newJob.id,
            newFiles: photoState.newFiles,
            newCaptions: photoState.newCaptions,
            keepIds: [],
            existing: [],
            updatedCaptions: {},
          });
        }
        if (newJob && crewMembers.length > 0) {
          await assignCrew.mutateAsync({
            jobId: newJob.id,
            members: crewMembers,
            userId: user?.id ?? null,
          });
        }
        toast({
          title: "Job created",
          description: `Job saved with ${servicesPayload.length} service(s), ${photoState.newFiles.length} photo(s), and ${crewMembers.length} crew member(s).`,
        });
        navigate("/admin/jobs");
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
  };

  if (loadingExisting) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  const durationDisplay = (() => {
    const mins = parseInt(form.estimatedDurationMinutes);
    if (isNaN(mins) || mins <= 0) return undefined;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  })();

  const urgencyHelper = URGENCY_OPTIONS.find((u) => u.value === form.urgency)?.helper;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Link to="/admin/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Jobs
      </Link>
      <h1 className="page-header">{isEdit ? "Edit" : "Create"} Job</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Payout */}
        <div className="metric-card space-y-4">
          <h2 className="section-title">Job Info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Customer</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setQuickCustomerOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New customer
                </Button>
              </div>
              <Select value={form.customerId} onValueChange={(v) => update("customerId", v)}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.filter((c) => !c.archived).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.serviceAddress.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const cust = customers.find((c) => c.id === form.customerId);
              const props = cust?.properties ?? [];
              if (!cust || props.length === 0) return null;
              return (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Property</Label>
                  <Select
                    value={form.customerPropertyId}
                    onValueChange={(v) => update("customerPropertyId", v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>
                      {props.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}{p.isPrimary ? " (Primary)" : ""} — {p.address.street}, {p.address.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Job address auto-fills from the selected property. You can override below.</p>
                </div>
              );
            })()}
            <div className="space-y-1.5">
              <Label>Amount <span className="text-xs text-muted-foreground">(CAD — auto-calculated from services if empty)</span></Label>
              <Input type="number" min="0" step="0.01" value={form.payout} onChange={(e) => update("payout", e.target.value)} placeholder={computedTotal > 0 ? `Auto: ${formatCAD(computedTotal)}` : "0.00"} />
            </div>
          </div>
        </div>

        {/* Services Line Items */}
        <div className="metric-card">
          <JobServiceLineItems
            items={serviceItems}
            onChange={setServiceItems}
            activeCategories={activeCategories}
          />
        </div>

        {/* Crew Assignment */}
        <div className="metric-card space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Users className="h-4 w-4" /> Crew Assignment
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Assign one or more SPs to this job. The first selected becomes Lead (click ★ to change).
            {isEdit && " Clearing the crew reverts the job to Created."}
          </p>
          <CrewPicker
            providers={providers}
            value={crewMembers}
            onChange={setCrewMembers}
            payout={parseFloat(form.payout) || computedTotal}
          />
        </div>

        {/* Location */}
        <div className="metric-card space-y-4">
          <h2 className="section-title">Job Location</h2>
          <p className="text-xs text-muted-foreground">Defaults to customer address. Override below if different.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Street</Label><Input value={form.street} onChange={(e) => update("street", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Province</Label><Input value={form.province} onChange={(e) => update("province", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Postal Code</Label><Input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Country</Label><Input value={form.country} onChange={(e) => update("country", e.target.value)} /></div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAutofillCoords} className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Auto-fill coordinates (approx)
          </Button>
        </div>

        {/* Urgency & Scheduling */}
        <div className="metric-card space-y-4">
          <h2 className="section-title">Urgency & Scheduling</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Urgency</Label>
              <div className="flex gap-3">
                {URGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("urgency", opt.value)}
                    className={`status-badge cursor-pointer transition-colors ${form.urgency === opt.value ? "bg-primary/10 text-primary border border-primary/30" : "bg-secondary text-secondary-foreground border border-transparent"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {urgencyHelper && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Info className="h-3 w-3" />{urgencyHelper}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date {form.urgency !== "Scheduled" && <span className="text-muted-foreground">(optional)</span>}</Label>
              <Input type="date" value={form.scheduledDate} onChange={(e) => update("scheduledDate", e.target.value)} required={form.urgency === "Scheduled"} />
            </div>
            <div className="space-y-1.5">
              <Label>Time {form.urgency !== "Scheduled" && <span className="text-muted-foreground">(optional)</span>}</Label>
              <Select value={form.scheduledTime} onValueChange={(v) => update("scheduledTime", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time">
                    {form.scheduledTime ? formatTime12h(form.scheduledTime) : "Select time"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{formatTime12h(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Duration</Label>
              <Select value={form.estimatedDurationMinutes} onValueChange={(v) => update("estimatedDurationMinutes", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration">
                    {durationDisplay || "Select duration"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Broadcast Mode */}
        <div className="metric-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title flex items-center gap-2"><Radio className="h-4 w-4" />Broadcast Mode</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Bypass allocation — send offers to all eligible SPs within radius</p>
            </div>
            <Switch checked={form.isBroadcast} onCheckedChange={(v) => setForm(f => ({ ...f, isBroadcast: v }))} />
          </div>
          {form.isBroadcast && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <Info className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-xs">Creates offers for all eligible SPs within radius. First accept wins.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Broadcast Radius (km)</Label>
                  <Input type="number" min={1} max={500} value={form.broadcastRadiusKm} onChange={(e) => update("broadcastRadiusKm", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Input value={form.broadcastNote} onChange={(e) => update("broadcastNote", e.target.value)} placeholder="e.g., Open to all SPs in radius" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="metric-card space-y-4">
          <h2 className="section-title">Job Instructions</h2>
          <Textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Add instructions for the crew — access codes, gate locations, parking, special requirements, etc."
            rows={4}
          />
        </div>

        <div className="metric-card">
          <JobPhotosUploader existing={existingPhotos} onChange={setPhotoState} />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : isEdit ? "Update" : "Create"} Job</Button>
          <Link to="/admin/jobs"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
