import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useServiceProviders } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle } from "lucide-react";

export default function AccountPage() {
  const { user } = useAuth();
  const { data: providers = [], isLoading } = useServiceProviders();
  const qc = useQueryClient();
  const { toast } = useToast();

  const sp = providers.find((p) => p.id === user?.spId) ?? providers[0];

  const [form, setForm] = useState({
    name: "",
    phone: "",
    street: "",
    city: "",
    province: "",
    postalCode: "",
    country: "",
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (sp && !loaded) {
      setForm({
        name: sp.name,
        phone: sp.phone,
        street: sp.baseAddress.street,
        city: sp.baseAddress.city,
        province: sp.baseAddress.province,
        postalCode: sp.baseAddress.postalCode,
        country: sp.baseAddress.country,
      });
      setLoaded(true);
    }
  }, [sp, loaded]);

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sp) return;
    setSaving(true);
    const { error } = await supabase.from("service_providers").update({
      name: form.name,
      phone: form.phone,
      base_address_street: form.street,
      base_address_city: form.city,
      base_address_region: form.province,
      base_address_postal: form.postalCode,
      base_address_country: form.country,
    }).eq("id", sp.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Account updated", description: "Your contact info has been saved." });
    }
  };

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;
  if (!sp) return <div className="py-20 text-center text-muted-foreground">Account not found.</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <UserCircle className="h-6 w-6 text-muted-foreground" />
        <h1 className="page-header">My Account</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="metric-card space-y-4">
          <h2 className="section-title">Contact Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Email</Label>
              <Input value={sp.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email changes are not supported. Contact admin to update.</p>
            </div>
          </div>
        </div>

        <div className="metric-card space-y-4">
          <h2 className="section-title">Base Address</h2>
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
          <h2 className="section-title">Service Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Service Radius</Label>
              <Input value={`${sp.travelRadius} km`} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Contact admin to change.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Max Jobs / Day</Label>
              <Input value={sp.maxJobsPerDay} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Contact admin to change.</p>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
      </form>
    </div>
  );
}
