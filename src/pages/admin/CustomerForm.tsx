import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCustomer, useCreateCustomer, useUpdateCustomer } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";

const TAG_OPTIONS = ["VIP", "Recurring", "Commercial", "Residential"];

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: existing, isLoading } = useCustomer(id);
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  const [form, setForm] = useState<null | {
    name: string; email: string; phone: string;
    street: string; city: string; province: string; postalCode: string; country: string;
    lat: string; lng: string; notes: string; tags: string[];
  }>(null);

  // Initialize form when data loads
  const formData = form ?? (isEdit && existing ? {
    name: existing.name, email: existing.email, phone: existing.phone,
    street: existing.serviceAddress.street, city: existing.serviceAddress.city,
    province: existing.serviceAddress.province, postalCode: existing.serviceAddress.postalCode,
    country: existing.serviceAddress.country,
    lat: existing.serviceAddress.lat?.toString() ?? "",
    lng: existing.serviceAddress.lng?.toString() ?? "",
    notes: existing.notes, tags: existing.tags,
  } : {
    name: "", email: "", phone: "", street: "", city: "", province: "AB",
    postalCode: "", country: "Canada", lat: "", lng: "", notes: "", tags: [],
  });

  if (isEdit && isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  const update = (field: string, value: string) => setForm({ ...formData, [field]: value });
  const toggleTag = (tag: string) => {
    setForm({
      ...formData,
      tags: formData.tags.includes(tag) ? formData.tags.filter((t) => t !== tag) : [...formData.tags, tag],
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && id) {
      updateMutation.mutate({ id, ...formData }, { onSuccess: () => navigate("/admin/customers") });
    } else {
      createMutation.mutate(formData, { onSuccess: () => navigate("/admin/customers") });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      <h1 className="page-header">{isEdit ? "Edit" : "Add"} Customer</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="metric-card space-y-4">
          <h2 className="section-title">Contact Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={formData.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => update("email", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => update("phone", e.target.value)} required />
            </div>
          </div>
        </div>

        <div className="metric-card space-y-4">
          <h2 className="section-title">Service Address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Street</Label>
              <Input value={formData.street} onChange={(e) => update("street", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={formData.city} onChange={(e) => update("city", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Province / State</Label>
              <Input value={formData.province} onChange={(e) => update("province", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Postal / Zip Code</Label>
              <Input value={formData.postalCode} onChange={(e) => update("postalCode", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={formData.country} onChange={(e) => update("country", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Latitude (optional)</Label>
              <Input value={formData.lat} onChange={(e) => update("lat", e.target.value)} placeholder="e.g. 51.0447" />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude (optional)</Label>
              <Input value={formData.lng} onChange={(e) => update("lng", e.target.value)} placeholder="e.g. -114.0719" />
            </div>
          </div>
        </div>

        <div className="metric-card space-y-4">
          <h2 className="section-title">Additional</h2>
          <div>
            <Label className="mb-2 block">Tags</Label>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`status-badge cursor-pointer transition-colors ${
                    formData.tags.includes(tag)
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-secondary text-secondary-foreground border border-transparent"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (gate code, pets, instructions)</Label>
            <Textarea value={formData.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : isEdit ? "Update" : "Create"} Customer</Button>
          <Link to="/admin/customers">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
