import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { customers } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TAG_OPTIONS = ["VIP", "Recurring", "Commercial", "Residential"];

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;
  const existing = isEdit ? customers.find((c) => c.id === id) : null;

  const [form, setForm] = useState({
    name: existing?.name ?? "",
    email: existing?.email ?? "",
    phone: existing?.phone ?? "",
    street: existing?.serviceAddress.street ?? "",
    city: existing?.serviceAddress.city ?? "",
    province: existing?.serviceAddress.province ?? "AB",
    postalCode: existing?.serviceAddress.postalCode ?? "",
    country: existing?.serviceAddress.country ?? "Canada",
    lat: existing?.serviceAddress.lat?.toString() ?? "",
    lng: existing?.serviceAddress.lng?.toString() ?? "",
    notes: existing?.notes ?? "",
    tags: existing?.tags ?? [],
  });

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });
  const toggleTag = (tag: string) => {
    setForm({
      ...form,
      tags: form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: isEdit ? "Customer updated" : "Customer created", description: `${form.name} has been saved (prototype — no persistence).` });
    navigate("/admin/customers");
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
          </div>
        </div>

        <div className="metric-card space-y-4">
          <h2 className="section-title">Service Address</h2>
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
                    form.tags.includes(tag)
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
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit">{isEdit ? "Update" : "Create"} Customer</Button>
          <Link to="/admin/customers">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
