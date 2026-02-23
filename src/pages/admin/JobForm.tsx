import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCustomers, useCreateJob, useUpdateJob, useActiveServiceCategories } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Info } from "lucide-react";

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
  const isEdit = !!id;
  const { data: customers = [] } = useCustomers();
  const activeCategories = useActiveServiceCategories();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();

  const [form, setForm] = useState({
    customerId: "",
    serviceCategory: "",
    customService: "",
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
  });
  const [loadingExisting, setLoadingExisting] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
      if (data) {
        const catNames = activeCategories.map((c) => c.name);
        setForm({
          customerId: data.customer_id ?? "",
          serviceCategory: catNames.includes(data.service_category) ? data.service_category : "custom",
          customService: catNames.includes(data.service_category) ? "" : data.service_category,
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
        });
      }
      setLoadingExisting(false);
    })();
  }, [id, isEdit, activeCategories.length]);

  // Auto-fill address from customer
  useEffect(() => {
    if (isEdit) return;
    const cust = customers.find((c) => c.id === form.customerId);
    if (cust) {
      setForm((f) => ({
        ...f,
        street: cust.serviceAddress.street,
        city: cust.serviceAddress.city,
        province: cust.serviceAddress.province,
        postalCode: cust.serviceAddress.postalCode,
        country: cust.serviceAddress.country,
        lat: cust.serviceAddress.lat?.toString() ?? "",
        lng: cust.serviceAddress.lng?.toString() ?? "",
      }));
    }
  }, [form.customerId, customers, isEdit]);

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });
  const isSaving = createJob.isPending || updateJob.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const serviceCategory = form.serviceCategory === "custom" ? form.customService : form.serviceCategory;
    const mins = parseInt(form.estimatedDurationMinutes);
    const estimatedDuration = !isNaN(mins) && mins > 0
      ? (mins >= 60 ? `${Math.floor(mins / 60)}${mins % 60 > 0 ? `.${Math.round((mins % 60) / 60 * 10) / 10 * 10}` : ""} hours` : `${mins} minutes`)
      : form.estimatedDurationMinutes;

    const payload = {
      customerId: form.customerId,
      serviceCategory,
      payout: form.payout,
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
      urgency: form.urgency,
    };
    if (isEdit && id) {
      updateJob.mutate({ id, ...payload }, { onSuccess: () => navigate("/admin/jobs") });
    } else {
      createJob.mutate(payload, { onSuccess: () => navigate("/admin/jobs") });
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
        <div className="metric-card space-y-4">
          <h2 className="section-title">Job Info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Customer</Label>
              <Select value={form.customerId} onValueChange={(v) => update("customerId", v)}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.filter((c) => !c.archived).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.serviceAddress.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Service Type</Label>
              <Select value={form.serviceCategory} onValueChange={(v) => update("serviceCategory", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {activeCategories.map((t) => (<SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>))}
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.serviceCategory === "custom" && (
              <div className="space-y-1.5">
                <Label>Custom Service</Label>
                <Input value={form.customService} onChange={(e) => update("customService", e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" min="0" step="0.01" value={form.payout} onChange={(e) => update("payout", e.target.value)} required />
            </div>
          </div>
        </div>

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
        </div>

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

        <div className="metric-card space-y-4">
          <h2 className="section-title">Notes</h2>
          <Textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Add any special instructions, access notes, or details for the SP..."
            rows={4}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : isEdit ? "Update" : "Create"} Job</Button>
          <Link to="/admin/jobs"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
