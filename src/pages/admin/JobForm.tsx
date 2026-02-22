import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCustomers, useCreateJob, useUpdateJob } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

const SERVICE_TYPES = ["Window Cleaning", "Gutter Cleaning", "Pressure Washing"];

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: customers = [] } = useCustomers();
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
    estimatedDuration: "",
  });
  const [loadingExisting, setLoadingExisting] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
      if (data) {
        setForm({
          customerId: data.customer_id ?? "",
          serviceCategory: SERVICE_TYPES.includes(data.service_category) ? data.service_category : "custom",
          customService: SERVICE_TYPES.includes(data.service_category) ? "" : data.service_category,
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
          estimatedDuration: data.estimated_duration ?? "",
        });
      }
      setLoadingExisting(false);
    })();
  }, [id, isEdit]);

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
      estimatedDuration: form.estimatedDuration,
    };
    if (isEdit && id) {
      updateJob.mutate({ id, ...payload }, { onSuccess: () => navigate("/admin/jobs") });
    } else {
      createJob.mutate(payload, { onSuccess: () => navigate("/admin/jobs") });
    }
  };

  if (loadingExisting) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

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
                  {SERVICE_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Street</Label>
              <Input value={form.street} onChange={(e) => update("street", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Province</Label>
              <Input value={form.province} onChange={(e) => update("province", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Postal Code</Label>
              <Input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => update("country", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="metric-card space-y-4">
          <h2 className="section-title">Scheduling (optional)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.scheduledDate} onChange={(e) => update("scheduledDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input value={form.scheduledTime} onChange={(e) => update("scheduledTime", e.target.value)} placeholder="e.g. 09:00 AM" />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Duration</Label>
              <Input value={form.estimatedDuration} onChange={(e) => update("estimatedDuration", e.target.value)} placeholder="e.g. 2 hours" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : isEdit ? "Update" : "Create"} Job</Button>
          <Link to="/admin/jobs"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
