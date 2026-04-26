import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSPInvoices, useJobs } from "@/hooks/useSupabaseData";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCAD } from "@/lib/currency";

export default function Earnings() {
  const [tab, setTab] = useState<"Unpaid" | "Paid">("Unpaid");
  const { data: invoices = [], isLoading } = useSPInvoices();
  const { data: jobs = [] } = useJobs();
  const jobByDb = useMemo(() => new Map(jobs.map((j) => [j.dbId, j])), [jobs]);

  const unpaid = invoices.filter((i) => i.status === "Unpaid");
  const paid = invoices.filter((i) => i.status === "Paid");

  const outstanding = unpaid.reduce((s, i) => s + i.netAmount, 0);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const paidThisMonth = paid
    .filter((i) => (i.paidAt ?? "").startsWith(monthKey))
    .reduce((s, i) => s + i.netAmount, 0);
  const paidAllTime = paid.reduce((s, i) => s + i.netAmount, 0);

  const list = tab === "Unpaid" ? unpaid : paid;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Earnings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Payouts owed to you and payment history.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold text-warning">{formatCAD(outstanding)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Paid this month</p>
          <p className="text-2xl font-bold text-success">{formatCAD(paidThisMonth)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Paid all-time</p>
          <p className="text-2xl font-bold">{formatCAD(paidAllTime)}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="Unpaid">Unpaid ({unpaid.length})</TabsTrigger>
          <TabsTrigger value="Paid">Paid ({paid.length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {isLoading ? (
            <p className="py-10 text-center text-muted-foreground">Loading...</p>
          ) : list.length === 0 ? (
            <div className="metric-card text-center py-10 text-muted-foreground">
              No {tab.toLowerCase()} invoices yet.
            </div>
          ) : (
            list.map((inv) => {
              const job = jobByDb.get(inv.jobId);
              return (
                <Link key={inv.id} to={`/sp/jobs/${inv.jobId}`} className="block">
                  <div className="metric-card hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{job?.id ?? inv.jobId.slice(0, 8)}</p>
                          <StatusBadge label={inv.status} variant={inv.status === "Paid" ? "valid" : "warning"} />
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {job?.customerName ?? "—"} · {job?.scheduledDate ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Gross {formatCAD(inv.grossAmount)} − fee {inv.feePercent}% ({formatCAD(inv.feeAmount)})
                        </p>
                        {inv.status === "Paid" && inv.paidAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Paid {new Date(inv.paidAt).toLocaleDateString()}
                            {inv.paymentMethod ? ` · ${inv.paymentMethod}` : ""}
                            {inv.paymentReference ? ` · Ref ${inv.paymentReference}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Net</p>
                        <p className="text-xl font-bold text-primary">{formatCAD(inv.netAmount)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
