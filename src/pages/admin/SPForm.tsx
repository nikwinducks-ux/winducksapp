import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useServiceProvider, useCreateSP, useUpdateSP, useActiveServiceCategories } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin } from "lucide-react";
import { autofillCoords, SUPPORTED_CITIES } from "@/lib/coord-autofill";
import { useToast } from "@/hooks/use-toast";
import { SPColorPicker } from "@/components/admin/SPColorPicker";
import type { PaletteKey } from "@/components/calendar/spColors";

export default function SPForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;
  const { data: existing, isLoading } = useServiceProvider(id);
  const createMutation = useCreateSP();
  const updateMutation = useUpdateSP();
  const activeCategories = useActiveServiceCategories();

  const [form, setForm] = useState<null | {
    name: string; email: string; phone: string; status: string;
    street: string; city: string; province: string; postalCode: string; country: string;
    lat: string; lng: string; travelRadius: string; maxJobsPerDay: string;
    notes: string; categories: string[]; calendarColor: string | null;
  }>(null);

  const formData = form ?? (isEdit && existing ? {
    name: existing.name, email: existing.email, phone: existing.phone, status: existing.status,
    street: existing.baseAddress.street, city: existing.baseAddress.city,
    province: existing.baseAddress.province, postalCode: existing.baseAddress.postalCode,
    country: existing.baseAddress.country,
    lat: existing.baseAddress.lat?.toString() ?? "",
    lng: existing.baseAddress.lng?.toString() ?? "",
    travelRadius: existing.travelRadius?.toString() ?? "30",
    maxJobsPerDay: existing.maxJobsPerDay?.toString() ?? "5",
    notes: existing.notes ?? "", categories: existing.serviceCategories ?? [],
    calendarColor: existing.calendarColor ?? null,
  } : {
    name: "", email: "", phone: "", status: "Active",
    street: "", city: "", province: "AB", postalCode: "", country: "Canada",
    lat: "", lng: "", travelRadius: "30", maxJobsPerDay: "5",
    notes: "", categories: [], calendarColor: null,
  });

  if (isEdit && isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  const update = (field: string, value: string) => setForm({ ...formData, [field]: value });
  const toggleCategory = (cat: string) => {
    setForm({
      ...formData,
      categories: formData.categories.includes(cat)
        ? formData.categories.filter((c) => c !== cat)
        : [...formData.categories, cat],
    });
  };
  const handleAutofillCoords = () => {
    const result = autofillCoords(formData.city);
    if (result) {
      setForm({ ...formData, lat: String(result.lat), lng: String(result.lng) });
      toast({ title: "Coordinates filled", description: `Approximate coords for ${formData.city}` });
    } else {
      toast({ title: "City not supported", description: `Supported: ${SUPPORTED_CITIES.join(", ")}. Enter coordinates manually.`, variant: "destructive" });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && id) {
      updateMutation.mutate({ id, ...formData }, { onSuccess: () => navigate("/admin/providers") });
    } else {
      createMutation.mutate(formData, { onSuccess: () => navigate("/admin/providers") });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Link to="/admin/providers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Providers
      </Link>

      <h1 className="page-header">{isEdit ? "Edit" : "Add"} Service Provider</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="metric-card space-y-4">
          <h2 className="section-title">Basic Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Name</Label><Input value={formData.name} onChange={(e) => update("name", e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => update("email", e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={formData.phone} onChange={(e) => update("phone", e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="metric-card space-y-4">
          <h2 className="section-title">Base Address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Street</Label><Input value={formData.street} onChange={(e) => update("street", e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>City</Label><Input value={formData.city} onChange={(e) => update("city", e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Province / State</Label><Input value={formData.province} onChange={(e) => update("province", e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Postal / Zip Code</Label><Input value={formData.postalCode} onChange={(e) => update("postalCode", e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Country</Label><Input value={formData.country} onChange={(e) => update("country", e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Latitude</Label><Input value={formData.lat} onChange={(e) => update("lat", e.target.value)} placeholder="e.g. 51.0447" /></div>
            <div className="space-y-1.5"><Label>Longitude</Label><Input value={formData.lng} onChange={(e) => update("lng", e.target.value)} placeholder="e.g. -114.0719" /></div>
            <div className="sm:col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={handleAutofillCoords} className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Auto-fill coordinates (approx)
              </Button>
            </div>
          </div>
        </div>

        <div className="metric-card space-y-4">
          <h2 className="section-title">Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Service Radius (km)</Label><Input type="number" value={formData.travelRadius} onChange={(e) => update("travelRadius", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Max Jobs / Day</Label><Input type="number" value={formData.maxJobsPerDay} onChange={(e) => update("maxJobsPerDay", e.target.value)} /></div>
          </div>
          <div>
            <Label className="mb-2 block">Service Categories</Label>
            <div className="flex flex-wrap gap-2">
              {activeCategories.map((cat) => (
                <button key={cat.id} type="button" onClick={() => toggleCategory(cat.name)}
                  className={`status-badge cursor-pointer transition-colors ${formData.categories.includes(cat.name) ? "bg-primary/10 text-primary border border-primary/30" : "bg-secondary text-secondary-foreground border border-transparent"}`}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Calendar Color</Label>
            <SPColorPicker
              value={formData.calendarColor}
              onChange={(key: PaletteKey | null) => setForm({ ...formData, calendarColor: key })}
            />
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => update("notes", e.target.value)} rows={3} /></div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : isEdit ? "Update" : "Create"} Provider</Button>
          <Link to="/admin/providers"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
