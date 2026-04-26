import { useState } from "react";
import { useCreateCustomer, type CustomerFormPayload } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (customerId: string) => void;
}

export function QuickCustomerDialog({ open, onOpenChange, onCreated }: Props) {
  const createMutation = useCreateCustomer();
  const [form, setForm] = useState({
    firstName: "", lastName: "", companyName: "", displayAs: "person" as "person" | "company",
    email: "", phone: "",
    street: "", city: "", province: "AB", postalCode: "", country: "Canada",
  });

  const reset = () => setForm({
    firstName: "", lastName: "", companyName: "", displayAs: "person",
    email: "", phone: "",
    street: "", city: "", province: "AB", postalCode: "", country: "Canada",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasName = form.firstName.trim() || form.lastName.trim() || form.companyName.trim();
    if (!hasName) {
      alert("Please provide a first/last name or a company name.");
      return;
    }
    const hasAddress = form.street.trim() || form.city.trim();
    const payload: CustomerFormPayload = {
      firstName: form.firstName,
      lastName: form.lastName,
      companyName: form.companyName,
      displayAs: form.displayAs,
      email: form.email,
      phone: form.phone,
      notes: "",
      tags: [],
      properties: hasAddress
        ? [{
            label: "Primary",
            isPrimary: true,
            street: form.street,
            city: form.city,
            province: form.province,
            postalCode: form.postalCode,
            country: form.country || "Canada",
            lat: "",
            lng: "",
            notes: "",
          }]
        : [],
      contacts: [],
    };
    const newId = await createMutation.mutateAsync(payload);
    if (newId) {
      onCreated(newId);
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick add customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
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
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Street</Label>
              <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Province / State</Label>
              <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Postal / Zip</Label>
              <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Country</Label>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            You can add more details, tags, and contacts later from the customer's profile.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create & select"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
