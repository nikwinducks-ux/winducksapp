import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useCustomerInvoices } from "@/hooks/useCustomerInvoices";
import { useCustomers } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCAD } from "@/lib/currency";
import { FileText, Search, Plus, AlertCircle } from "lucide-react";
import { NewInvoiceDialog } from "@/components/invoices/NewInvoiceDialog";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "valid" | "warning" | "error"> = {
  Draft: "neutral",
  Sent: "info",
  Viewed: "info",
  "Partially Paid": "warning",
  Paid: "valid",
  Overdue: "warning",
  Void: "error",
  Cancelled: "error",
  Archived: "neutral",
};

export default function InvoicesList() {
  const { data: invoices = [], isLoading } = useCustomerInvoices();
  const { data: customers = [] } = useCustomers();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showNew, setShowNew] = useState(false);

  const customerById = useMemo(() => {
    const m = new Map<string, string>();
    customers.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const today = new Date().toISOString().slice(0, 10);

  const enriched = useMemo(() => {
    return invoices.map((inv: any) => {
      const isOverdue =
        inv.status !== "Paid" && inv.status !== "Void" && inv.status !== "Archived" &&
        inv.status !== "Draft" && inv.due_date && inv.due_date < today &&
        Number(inv.balance_due ?? inv.total ?? 0) > 0;
      return { ...inv, _isOverdue: isOverdue };
    });
  }, [invoices, today]);

  const filtered = useMemo(() => {
    return enriched.filter((inv: any) => {
      if (statusFilter === "Overdue") {
        if (!inv._isOverdue) return false;
      } else if (statusFilter !== "All" && inv.status !== statusFilter) return false;
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
  }, [enriched, statusFilter, search, customerById]);

  const totals = useMemo(() => {
    const t = { total: 0, outstanding: 0, paid: 0, overdue: 0, draft: 0 };
    enriched.forEach((inv: any) => {
      const total = Number(inv.total || 0);
      const balance = Number(inv.balance_due ?? total);
      const paid = Number(inv.amount_paid || 0) + Number(inv.deposit_applied || 0);
      t.total += total;
      t.paid += Math.min(paid, total);
      if (inv.status === "Draft") t.draft += total;
      else if (inv.status !== "Paid" && inv.status !== "Void" && inv.status !== "Archived") {
        t.outstanding += balance;
        if (inv._isOverdue) t.overdue += balance;
      }
    });
    return t;
  }, [enriched]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Invoices</h1>
          <p className="text-sm text-muted-foreground">Bill customers for services and products. Track payments and outstanding balances.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" />New invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">All invoices</p>
          <p className="text-2xl font-bold">{formatCAD(totals.total)}</p>
          <p className="text-xs text-muted-foreground mt-1">{invoices.length} total</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold text-warning">{formatCAD(totals.outstanding)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Overdue
          </p>
          <p className="text-2xl font-bold text-destructive">{formatCAD(totals.overdue)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Collected</p>
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
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Viewed">Viewed</SelectItem>
            <SelectItem value="Partially Paid">Partially Paid</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
            <SelectItem value="Void">Void</SelectItem>
            <SelectItem value="Archived">Archived</SelectItem>
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
              Create one manually, or convert from an accepted estimate / completed job.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium">Invoice #</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-right p-3 font-medium">Balance</th>
                  <th className="text-left p-3 font-medium">Issued</th>
                  <th className="text-left p-3 font-medium">Due</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv: any) => {
                  const balance = Number(inv.balance_due ?? inv.total ?? 0);
                  const status = inv._isOverdue && inv.status !== "Overdue" ? "Overdue" : inv.status;
                  return (
                    <tr key={inv.id} className={`border-t hover:bg-muted/30 ${inv._isOverdue ? "bg-destructive/5" : ""}`}>
                      <td className="p-3 font-mono text-xs">
                        <Link to={`/admin/invoices/${inv.id}`} className="hover:underline">{inv.invoice_number}</Link>
                      </td>
                      <td className="p-3">{inv.customer_id ? customerById.get(inv.customer_id) || "—" : "—"}</td>
                      <td className="p-3">
                        <StatusBadge label={status} variant={STATUS_VARIANT[status] || "neutral"} />
                      </td>
                      <td className="p-3 text-right font-medium">{formatCAD(inv.total)}</td>
                      <td className="p-3 text-right">
                        {balance > 0 ? (
                          <span className={inv._isOverdue ? "text-destructive font-semibold" : "text-warning font-medium"}>
                            {formatCAD(balance)}
                          </span>
                        ) : (
                          <span className="text-success">{formatCAD(0)}</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-3 text-right">
                        <Link to={`/admin/invoices/${inv.id}`}>
                          <Button size="sm" variant="outline">Open</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewInvoiceDialog open={showNew} onOpenChange={setShowNew} />
    </div>
  );
}
