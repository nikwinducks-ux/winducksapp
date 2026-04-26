import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSPInvoices, useServiceProviders, useMarkInvoiceUnpaid, useAppSettings, useUpdateAppSettings, type SPInvoice } from "@/hooks/useSupabaseData";
import { useJobs } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { MarkPaidDialog } from "@/components/admin/MarkPaidDialog";
import { formatCAD } from "@/lib/currency";
import { DollarSign, Save } from "lucide-react";

export default function Payouts() {
  const [statusFilter, setStatusFilter] = useState<"All" | "Unpaid" | "Paid">("Unpaid");
  const [spFilter, setSpFilter] = useState<string>("all");
  const { data: invoices = [], isLoading } = useSPInvoices({ status: statusFilter });
  const { data: providers = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();
  const { data: settings } = useAppSettings();
  const updateSettings = useUpdateAppSettings();
  const markUnpaid = useMarkInvoiceUnpaid();

  const [feeInput, setFeeInput] = useState<string>("");
  const currentFee = settings?.defaultPayoutFeePercent ?? 0;

  const [paidDialogInvoice, setPaidDialogInvoice] = useState<SPInvoice | null>(null);

  const spById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  const jobByDb = useMemo(() => new Map(jobs.map((j) => [j.dbId, j])), [jobs]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => spFilter === "all" || inv.spId === spFilter);
  }, [invoices, spFilter]);

  const totals = useMemo(() => {
    const outstanding = filtered.filter((i) => i.status === "Unpaid").reduce((s, i) => s + i.netAmount, 0);
    const paid = filtered.filter((i) => i.status === "Paid").reduce((s, i) => s + i.netAmount, 0);
    return { outstanding, paid };
  }, [filtered]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track what each Service Provider is owed and mark invoices as paid.</p>
      </div>

      <div className="metric-card space-y-3">
        <h2 className="section-title flex items-center gap-2"><DollarSign className="h-4 w-4" /> Global default platform fee</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Default fee % (applies when SP has no override)</Label>
            <Input
              type="number" step="0.01" min="0" max="100"
              value={feeInput !== "" ? feeInput : String(currentFee)}
              onChange={(e) => setFeeInput(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            onClick={() => updateSettings.mutate({ defaultPayoutFeePercent: Number(feeInput || currentFee) })}
            disabled={updateSettings.isPending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" /> Save
          </Button>
          <p className="text-xs text-muted-foreground">Currently: {currentFee}%</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Outstanding (Unpaid net)</p>
          <p className="text-2xl font-bold text-warning">{formatCAD(totals.outstanding)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-muted-foreground">Paid (filtered)</p>
          <p className="text-2xl font-bold text-success">{formatCAD(totals.paid)}</p>
        </div>
      </div>

      <div className="metric-card space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Service Provider</Label>
            <Select value={spFilter} onValueChange={setSpFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                {providers.map((sp) => (
                  <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No invoices match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">SP</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Completed</th>
                  <th className="py-2 pr-3 text-right">Gross</th>
                  <th className="py-2 pr-3 text-right">Fee</th>
                  <th className="py-2 pr-3 text-right">Net</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const sp = spById.get(inv.spId);
                  const job = jobByDb.get(inv.jobId);
                  return (
                    <tr key={inv.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">
                        <Link to={`/admin/jobs/${inv.jobId}`} className="text-primary hover:underline">
                          {job?.id ?? inv.jobId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{sp?.name ?? "—"}</td>
                      <td className="py-2 pr-3">{job?.customerName ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{job?.scheduledDate ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{formatCAD(inv.grossAmount)}</td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">
                        {inv.feePercent}% · {formatCAD(inv.feeAmount)}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold">{formatCAD(inv.netAmount)}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge label={inv.status} variant={inv.status === "Paid" ? "valid" : "warning"} />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {inv.status === "Unpaid" ? (
                          <Button size="sm" onClick={() => setPaidDialogInvoice(inv)}>Mark Paid</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => markUnpaid.mutate(inv.id)}>
                            Revert
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MarkPaidDialog
        invoice={paidDialogInvoice}
        open={!!paidDialogInvoice}
        onOpenChange={(o) => { if (!o) setPaidDialogInvoice(null); }}
      />
    </div>
  );
}
