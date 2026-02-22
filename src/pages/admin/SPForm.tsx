import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { serviceProviders } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ALL_CATEGORIES = ["Window Cleaning", "Gutter Cleaning", "Pressure Washing"];

export default function SPForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;
  const existing = isEdit ? serviceProviders.find((s) => s.id === id) : null;

  const [form, setForm] = useState({
    name: existing?.name ?? "",
    email: existing?.email ?? "",
    phone: existing?.phone ?? "",
    status: existing?.status ?? "Active",
    street: existing?.baseAddress.street ?? "",
    city: existing?.baseAddress.city ?? "",
    province: existing?.baseAddress.province ?? "AB",
    postalCode: existing?.baseAddress.postalCode ?? "",
    country: existing?.baseAddress.country ?? "Canada",
    lat: existing?.baseAddress.lat?.toString() ?? "",
    lng: existing?.baseAddress.lng?.toString() ?? "",
    travelRadius: existing?.travelRadius?.toString() ?? "30",
    maxJobsPerDay: existing?.maxJobsPerDay?.toString() ?? "5",
    notes: existing?.notes ?? "",
    categories: existing?.serviceCategories ?? [],
  });

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });
  const toggleCategory = (cat: string) => {
    setForm({
      ...form,
      categories: form.categories.includes(cat)
        ? form.categories.filter((c) => c !== cat)
        : [...form.categories, cat],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: isEdit ? "Provider updated" : "Provider created", description: `${form.name} has been saved (prototype — no persistence).` });
    navigate("/admin/providers");
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
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Street</Label>
              <Input value={form.street} onChange={(e) => update("street", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Province / State</Label>
              <Input value={form.province} onChange={(e) => update("province", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Postal / Zip Code</Label>
              <Input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => update("country", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Latitude (optional)</Label>
              <Input value={form.lat} onChange={(e) => update("lat", e.target.value)} placeholder="e.g. 51.0447" />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude (optional)</Label>
              <Input value={form.lng} onChange={(e) => update("lng", e.target.value)} placeholder="e.g. -114.0719" />
            </div>
          </div>
        </div>

        <div className="metric-card space-y-4">
          <h2 className="section-title">Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Service Radius (km)</Label>
              <Input type="number" value={form.travelRadius} onChange={(e) => update("travelRadius", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Max Jobs / Day</Label>
              <Input type="number" value={form.maxJobsPerDay} onChange={(e) => update("maxJobsPerDay", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Service Categories</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`status-badge cursor-pointer transition-colors ${
                    form.categories.includes(cat)
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-secondary text-secondary-foreground border border-transparent"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit">{isEdit ? "Update" : "Create"} Provider</Button>
          <Link to="/admin/providers">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
