import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCustomer, useJobs } from "@/hooks/useSupabaseData";
import { formatAddress } from "@/data/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CustomerActivityLog } from "@/components/CustomerActivityLog";
import { ArrowLeft, MapPin, Pencil, History } from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: jobs = [] } = useJobs();

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

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">{customer.email} · {customer.phone}</p>
        </div>
        <Link to={`/admin/customers/${customer.id}/edit`}>
          <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-2" />Edit</Button>
        </Link>
      </div>

      {customer.tags.length > 0 && (
        <div className="flex gap-2">
          {customer.tags.map((t) => (
            <span key={t} className="status-badge bg-primary/10 text-primary">{t}</span>
          ))}
        </div>
      )}

      <div className="metric-card space-y-4">
        <h2 className="section-title">Service Address</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Street</p>
            <p className="text-sm font-medium">{customer.serviceAddress.street}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">City</p>
            <p className="text-sm font-medium">{customer.serviceAddress.city}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Province</p>
            <p className="text-sm font-medium">{customer.serviceAddress.province}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Postal Code</p>
            <p className="text-sm font-medium">{customer.serviceAddress.postalCode}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Coordinates</p>
            <p className="text-sm font-medium">
              {customer.serviceAddress.lat && customer.serviceAddress.lng
                ? `${customer.serviceAddress.lat}, ${customer.serviceAddress.lng}`
                : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Full Address</p>
            <p className="text-sm font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              {formatAddress(customer.serviceAddress)}
            </p>
          </div>
        </div>
      </div>

      {customer.notes && (
        <div className="metric-card">
          <h2 className="section-title mb-2">Notes</h2>
          <p className="text-sm text-muted-foreground">{customer.notes}</p>
        </div>
      )}

      <div className="metric-card space-y-4">
        <h2 className="section-title">Job History</h2>
        {customerJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs on record.</p>
        ) : (
          <div className="space-y-2">
            {customerJobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 text-sm">
                <div>
                  <span className="font-medium">{j.id}</span>
                  <span className="text-muted-foreground ml-2">{j.serviceCategory} · {j.scheduledDate}</span>
                </div>
                <StatusBadge label={j.status === "InProgress" ? "In Progress" : j.status} variant={j.status === "Completed" ? "valid" : j.status === "Created" ? "neutral" : "info"} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
