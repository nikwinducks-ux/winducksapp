import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useCustomer, useCreateCustomer, useUpdateCustomer,
  useCustomerTags, useCreateCustomerTag,
  TAG_COLOR_OPTIONS, tagColorClass,
  type CustomerFormProperty, type CustomerFormContact, type CustomerFormPayload,
} from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Star, StarOff } from "lucide-react";

const emptyProperty = (label = "Primary"): CustomerFormProperty => ({
  label, isPrimary: false,
  street: "", city: "", province: "AB", postalCode: "", country: "Canada",
  lat: "", lng: "", notes: "",
});

const emptyContact = (): CustomerFormContact => ({
  name: "", role: "", phone: "", email: "", isPrimary: false,
});

export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: existing, isLoading } = useCustomer(id);
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const { data: tagCatalog = [] } = useCustomerTags();
  const createTagMutation = useCreateCustomerTag();

  const [form, setForm] = useState<CustomerFormPayload>({
    firstName: "", lastName: "", companyName: "", displayAs: "person",
    email: "", phone: "", notes: "", tags: [],
    properties: [{ ...emptyProperty("Primary"), isPrimary: true }],
    contacts: [],
  });
  const [hydrated, setHydrated] = useState(false);

  // New-tag dialog state
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("primary");

  useEffect(() => {
    if (!isEdit || hydrated || !existing) return;
    setForm({
      firstName: existing.firstName ?? "",
      lastName: existing.lastName ?? "",
      companyName: existing.companyName ?? "",
      displayAs: (existing.displayAs ?? "person") as "person" | "company",
      email: existing.email,
      phone: existing.phone,
      notes: existing.notes,
      tags: existing.tags ?? [],
      properties: (existing.properties ?? []).map((p) => ({
        id: p.id,
        label: p.label,
        isPrimary: p.isPrimary,
        street: p.address.street,
        city: p.address.city,
        province: p.address.province,
        postalCode: p.address.postalCode,
        country: p.address.country,
        lat: p.address.lat?.toString() ?? "",
        lng: p.address.lng?.toString() ?? "",
        notes: p.notes,
      })),
      contacts: (existing.contacts ?? []).map((c) => ({
        id: c.id, name: c.name, role: c.role, phone: c.phone, email: c.email, isPrimary: c.isPrimary,
      })),
    });
    setHydrated(true);
  }, [existing, isEdit, hydrated]);

  if (isEdit && isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Property helpers
  const updateProperty = (idx: number, field: keyof CustomerFormProperty, value: string | boolean) => {
    setForm((f) => ({
      ...f,
      properties: f.properties.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    }));
  };
  const setPrimaryProperty = (idx: number) => {
    setForm((f) => ({
      ...f,
      properties: f.properties.map((p, i) => ({ ...p, isPrimary: i === idx })),
    }));
  };
  const addProperty = () =>
    setForm((f) => ({ ...f, properties: [...f.properties, emptyProperty(`Property ${f.properties.length + 1}`)] }));
  const removeProperty = (idx: number) => {
    setForm((f) => {
      const next = f.properties.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((p) => p.isPrimary)) next[0].isPrimary = true;
      return { ...f, properties: next };
    });
  };

  // Contact helpers
  const updateContact = (idx: number, field: keyof CustomerFormContact, value: string | boolean) => {
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };
  const setPrimaryContact = (idx: number) => {
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => ({ ...c, isPrimary: i === idx })),
    }));
  };
  const addContact = () => setForm((f) => ({ ...f, contacts: [...f.contacts, emptyContact()] }));
  const removeContact = (idx: number) =>
    setForm((f) => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }));

  // Tag helpers
  const toggleTag = (name: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(name) ? f.tags.filter((t) => t !== name) : [...f.tags, name],
    }));
  };
  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const tag = await createTagMutation.mutateAsync({ name, color: newTagColor });
    setForm((f) => ({ ...f, tags: f.tags.includes(tag.name) ? f.tags : [...f.tags, tag.name] }));
    setNewTagName("");
    setNewTagColor("primary");
    setTagDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Require at least one of: first name, last name, or company name
    const hasName = form.firstName.trim() || form.lastName.trim() || form.companyName.trim();
    if (!hasName) {
      alert("Please provide a first/last name or a company name.");
      return;
    }
    if (isEdit && id) {
      updateMutation.mutate({ id, ...form }, { onSuccess: () => navigate(`/admin/customers/${id}`) });
    } else {
      createMutation.mutate(form, {
        onSuccess: (newId) => navigate(newId ? `/admin/customers/${newId}` : "/admin/customers"),
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      <h1 className="page-header">{isEdit ? "Edit" : "Add"} Customer</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity */}
        <div className="metric-card space-y-4">
          <h2 className="section-title">Identity</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Company name</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Display as</Label>
              <Select value={form.displayAs} onValueChange={(v) => setForm({ ...form, displayAs: v as "person" | "company" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Person — show first/last name</SelectItem>
                  <SelectItem value="company">Company — show company name</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Determines what shows up everywhere as the customer's display name.</p>
            </div>
          </div>
        </div>

        {/* Primary Contact */}
        <div className="metric-card space-y-4">
          <h2 className="section-title">Primary Contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Properties */}
        <div className="metric-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Properties / Addresses</h2>
            <Button type="button" variant="outline" size="sm" onClick={addProperty}>
              <Plus className="h-4 w-4 mr-1" /> Add property
            </Button>
          </div>
          {form.properties.length === 0 && (
            <p className="text-sm text-muted-foreground">No properties yet. Add one to use when creating jobs.</p>
          )}
          <div className="space-y-4">
            {form.properties.map((p, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Input
                      value={p.label}
                      onChange={(e) => updateProperty(idx, "label", e.target.value)}
                      placeholder="Label (e.g. Home, Cabin)"
                      className="h-8 w-48"
                    />
                    <Button
                      type="button"
                      variant={p.isPrimary ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPrimaryProperty(idx)}
                      title={p.isPrimary ? "Primary" : "Set as primary"}
                    >
                      {p.isPrimary ? <Star className="h-3.5 w-3.5 mr-1 fill-current" /> : <StarOff className="h-3.5 w-3.5 mr-1" />}
                      {p.isPrimary ? "Primary" : "Set primary"}
                    </Button>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeProperty(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Street</Label>
                    <Input value={p.street} onChange={(e) => updateProperty(idx, "street", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">City</Label>
                    <Input value={p.city} onChange={(e) => updateProperty(idx, "city", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Province / State</Label>
                    <Input value={p.province} onChange={(e) => updateProperty(idx, "province", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Postal / Zip</Label>
                    <Input value={p.postalCode} onChange={(e) => updateProperty(idx, "postalCode", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Country</Label>
                    <Input value={p.country} onChange={(e) => updateProperty(idx, "country", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Latitude</Label>
                    <Input value={p.lat} onChange={(e) => updateProperty(idx, "lat", e.target.value)} placeholder="51.0447" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Longitude</Label>
                    <Input value={p.lng} onChange={(e) => updateProperty(idx, "lng", e.target.value)} placeholder="-114.0719" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Property notes</Label>
                    <Textarea rows={2} value={p.notes} onChange={(e) => updateProperty(idx, "notes", e.target.value)} placeholder="Gate code, pets, parking, etc." />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Contacts */}
        <div className="metric-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Additional Contacts</h2>
            <Button type="button" variant="outline" size="sm" onClick={addContact}>
              <Plus className="h-4 w-4 mr-1" /> Add contact
            </Button>
          </div>
          {form.contacts.length === 0 && (
            <p className="text-sm text-muted-foreground">No additional contacts. The Primary Contact above is used by default.</p>
          )}
          <div className="space-y-4">
            {form.contacts.map((c, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant={c.isPrimary ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPrimaryContact(idx)}
                  >
                    {c.isPrimary ? <Star className="h-3.5 w-3.5 mr-1 fill-current" /> : <StarOff className="h-3.5 w-3.5 mr-1" />}
                    {c.isPrimary ? "Primary contact" : "Set primary"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input value={c.name} onChange={(e) => updateContact(idx, "name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Role</Label>
                    <Input value={c.role} onChange={(e) => updateContact(idx, "role", e.target.value)} placeholder="Spouse, Property Manager" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input value={c.phone} onChange={(e) => updateContact(idx, "phone", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={c.email} onChange={(e) => updateContact(idx, "email", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tags + Notes */}
        <div className="metric-card space-y-4">
          <h2 className="section-title">Tags & Notes</h2>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Tags</Label>
              <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />New tag</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create tag</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="e.g. VIP" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {TAG_COLOR_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setNewTagColor(opt.value)}
                            className={`status-badge cursor-pointer border ${opt.className} ${newTagColor === opt.value ? "ring-2 ring-ring ring-offset-1" : ""}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setTagDialogOpen(false)}>Cancel</Button>
                    <Button type="button" onClick={handleCreateTag} disabled={!newTagName.trim() || createTagMutation.isPending}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagCatalog.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No tags yet — click "New tag" to create one, or <Link to="/admin/customers/tags" className="text-primary hover:underline">manage tags</Link>.
                </p>
              )}
              {tagCatalog.map((tag) => {
                const selected = form.tags.includes(tag.name);
                const colorCls = tagColorClass(tag.color);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className={`status-badge cursor-pointer border transition-all ${
                      selected ? colorCls : "bg-secondary text-secondary-foreground border-transparent opacity-70"
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Internal notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Any general notes about this customer." />
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
