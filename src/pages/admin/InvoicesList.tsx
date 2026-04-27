import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useCustomerInvoices } from "@/hooks/useCustomerInvoices";
import { useCustomers } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCAD } from "@/lib/currency";
import { FileText, Search } from "lucide-react";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "valid" | "warning" | "error"> = {
  Draft: "neutral",
  Sent: "info",
  Paid: "valid",
  Overdue: "warning",
  Cancelled: "error",
};

export default function InvoicesList() {
  const { data: invoices = [], isLoading } = useCustomerInvoices();
  const { data: customers = [] } = useCustomers();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const customerById = useMemo(() => {
    const m = new Map<string, string>();
    customers.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "All" && inv.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const customerName = inv.customer_id ? (customerById.get(inv.customer_id) || "") : "";
        return (
          inv.invoice_number.toLowerCase().includes(q) ||
          customerName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoices, statusFilter, search, customerById]);

  const totals = useMemo(() => {
    const t = { total: 0, outstanding: 0, paid: 0 };
    invoices.forEach((inv) => {
      t.total += Number(inv.total || 0);
      if (inv.status === "Paid") t.paid += Number(inv.total || 0);
      else if (inv.status === "Sent" || inv.status === "Overdue") t.outstanding += Number(inv.total || 0);
    });
    return t;
  }, [invoices]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Invoices</h1>
          <p className="text-sm text-muted-foreground">Customer invoices created from completed jobs.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">All Invoices</p>
          <p className="text-2xl font-bold">{formatCAD(totals.total)}</p>
          <p className="text-xs text-muted-foreground mt-1">{invoices.length} total</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold text-warning">{formatCAD(totals.outstanding)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Paid</p>
          <p className="text-2xl font-bold text-success">{formatCAD(totals.paid)}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="metric-card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No invoices found.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Invoices are created by converting a completed job from the job detail page.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Invoice #</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">Created</th>
                <th className="text-left p-3 font-medium">Sent</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="p-3">{inv.customer_id ? customerById.get(inv.customer_id) || "—" : "—"}</td>
                  <td className="p-3">
                    <StatusBadge label={inv.status} variant={STATUS_VARIANT[inv.status] || "neutral"} />
                  </td>
                  <td className="p-3 text-right font-medium">{formatCAD(inv.total)}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Link to={`/admin/invoices/${inv.id}`}>
                      <Button size="sm" variant="outline">Open</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
