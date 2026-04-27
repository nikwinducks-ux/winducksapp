import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCustomer, useJobs, useCustomerTags, tagColorClass } from "@/hooks/useSupabaseData";
import { formatAddress } from "@/data/mockData";
import { formatCAD } from "@/lib/currency";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CustomerActivityLog } from "@/components/CustomerActivityLog";
import { ArrowLeft, MapPin, Pencil, History, Star, Mail, Phone, Building2, FileText, Receipt } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function CustomerDetail() {
  const { id } = useParams();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: jobs = [] } = useJobs();
  const { data: tagCatalog = [] } = useCustomerTags();
  const [logOpen, setLogOpen] = useState(false);

  const { data: estimates = [] } = useQuery({
    queryKey: ["customer_estimates", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from("estimates")
        .select("id,estimate_number,status,estimate_date,accepted_total")
        .eq("customer_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["customer_invoices_list", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from("customer_invoices")
        .select("id,invoice_number,status,invoice_date,total,balance_due")
        .eq("customer_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Customer not found</p>
        <Link to="/admin/customers" className="text-primary hover:underline mt-2 text-sm">Back to Customers</Link>
      </div>
    );
  }

  const customerJobs = jobs.filter((j) => j.customerId === customer.id);
  const properties = customer.properties ?? [];
  const contacts = customer.contacts ?? [];
  const personName = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim();
  const subtitle =
    customer.displayAs === "company"
      ? personName || ""
      : customer.companyName || "";

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-header truncate">{customer.name}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              {customer.displayAs === "person" ? <Building2 className="h-3.5 w-3.5" /> : null}
              {subtitle}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">{customer.email} · {customer.phone}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
            <History className="h-4 w-4 mr-2" />Log
          </Button>
          <Link to={`/admin/customers/${customer.id}/edit`}>
            <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-2" />Edit</Button>
          </Link>
        </div>
      </div>

      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
          <SheetHeader>
            <SheetTitle>{customer.name} — Activity Log</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 mt-4">
            <CustomerActivityLog customerId={customer.id} />
          </div>
        </SheetContent>
      </Sheet>

      {customer.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customer.tags.map((tagName) => {
            const tag = tagCatalog.find((t) => t.name === tagName);
            return (
              <span key={tagName} className={`status-badge border ${tagColorClass(tag?.color)}`}>
                {tagName}
              </span>
            );
          })}
        </div>
      )}

      {/* Properties */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Properties</h2>
        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">No properties on file.</p>
        ) : (
          <div className="space-y-3">
            {properties.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 bg-secondary/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{p.label}</span>
                    {p.isPrimary && (
                      <span className="status-badge bg-primary/10 text-primary border border-primary/30 inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" /> Primary
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {formatAddress(p.address)}
                </p>
                {(p.address.lat != null && p.address.lng != null) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.address.lat.toFixed(4)}, {p.address.lng.toFixed(4)}
                  </p>
                )}
                {p.notes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{p.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contacts */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Additional Contacts</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No additional contacts.</p>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-lg border p-3 bg-secondary/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{c.name || "Contact"}</span>
                  {c.role && <span className="text-xs text-muted-foreground">· {c.role}</span>}
                  {c.isPrimary && (
                    <span className="status-badge bg-primary/10 text-primary border border-primary/30 inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> Primary
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {customer.notes && (
        <div className="metric-card">
          <h2 className="section-title mb-2">Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}

      <div className="metric-card space-y-4">
        <h2 className="section-title">Job History</h2>
        {customerJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs on record.</p>
        ) : (
          <div className="space-y-2">
            {customerJobs.map((j) => (
              <Link
                key={j.id}
                to={`/admin/jobs/${j.dbId}`}
                className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 text-sm hover:bg-secondary transition-colors"
              >
                <div>
                  <span className="font-medium text-primary">{j.id}</span>
                  <span className="text-muted-foreground ml-2">{j.serviceCategory} · {j.scheduledDate}</span>
                </div>
                <StatusBadge label={j.status === "InProgress" ? "In Progress" : j.status} variant={j.status === "Completed" ? "valid" : j.status === "Created" ? "neutral" : "info"} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
