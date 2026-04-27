import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  useInvoicePackages, useInvoiceLineItems, useInvoicePayments,
  useInvoiceManualDiscounts, useInvoiceAppliedCodes,
  useUpdateInvoice, useUpsertInvoicePackage, useDeleteInvoicePackage,
  useDuplicateInvoicePackage, useReplaceInvoiceLineItems,
  useApplyInvoiceCode, useRemoveInvoiceCode,
  useUpsertInvoiceManualDiscount, useRemoveInvoiceManualDiscount,
  useVoidInvoice, useArchiveInvoice, useUnarchiveInvoice,
  type InvoicePackage,
} from "@/hooks/useInvoices";
import {
  useCustomerInvoice, useMarkInvoiceSent, useSendInvoiceEmail, useDeleteInvoice,
} from "@/hooks/useCustomerInvoices";
import { useCustomers, useAppSettings } from "@/hooks/useSupabaseData";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCAD } from "@/lib/currency";
import {
  ArrowLeft, Save, Send, Plus, Trash2, Copy, CheckCircle2, FileText,
  Receipt, Ban, Archive, ArchiveRestore, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InvoicePackageCard, type EditableInvoiceLine } from "@/components/invoices/InvoicePackageCard";
import { InvoiceTotals } from "@/components/invoices/InvoiceTotals";
import { RecordPaymentDialog } from "@/components/invoices/RecordPaymentDialog";
import { ManualDiscountDialog } from "@/components/invoices/ManualDiscountDialog";
import { DiscountCodeInput } from "@/components/estimates/DiscountCodeInput";
import { computeInvoiceTotals } from "@/lib/invoiceTotals";
import { WorkflowStepper, buildInvoiceStages } from "@/components/workflow/WorkflowStepper";
import { ActivityTimelineCard } from "@/components/workflow/ActivityTimeline";
import { useInvoiceTimeline } from "@/hooks/useWorkflowEvents";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "valid" | "warning" | "error"> = {
  Draft: "neutral", Sent: "info", Viewed: "info", "Partially Paid": "warning",
  Paid: "valid", Overdue: "warning", Void: "error", Cancelled: "error", Archived: "neutral",
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: invoice, isLoading } = useCustomerInvoice(id);
  const { data: timeline = [], isLoading: timelineLoading } = useInvoiceTimeline(id);
  const { data: packages = [] } = useInvoicePackages(id);
  const pkgIds = useMemo(() => packages.map((p) => p.id), [packages]);
  const { data: dbItems = [] } = useInvoiceLineItems(pkgIds);
  const { data: payments = [] } = useInvoicePayments(id);
  const { data: appliedCodes = [] } = useInvoiceAppliedCodes(id);
  const { data: manualDiscounts = [] } = useInvoiceManualDiscounts(id);
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: settings } = useAppSettings();

  const update = useUpdateInvoice();
  const upsertPkg = useUpsertInvoicePackage();
  const deletePkg = useDeleteInvoicePackage();
  const dupPkg = useDuplicateInvoicePackage();
  const replaceItems = useReplaceInvoiceLineItems();
  const applyCode = useApplyInvoiceCode();
  const removeCode = useRemoveInvoiceCode();
  const removeDiscount = useRemoveInvoiceManualDiscount();
  const voidInv = useVoidInvoice();
  const archiveInv = useArchiveInvoice();
  const unarchiveInv = useUnarchiveInvoice();
  const markSent = useMarkInvoiceSent();
  const sendEmail = useSendInvoiceEmail();
  const del = useDeleteInvoice();

  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(15);
  const [taxPct, setTaxPct] = useState(5);
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [depositApplied, setDepositApplied] = useState(0);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [packageState, setPackageState] = useState<Record<string, InvoicePackage>>({});
  const [itemsState, setItemsState] = useState<Record<string, EditableInvoiceLine[]>>({});

  const [paymentDialog, setPaymentDialog] = useState(false);
  const [discountDialog, setDiscountDialog] = useState(false);

  useEffect(() => {
    if (invoice) {
      setCustomerId(invoice.customer_id ?? "");
      setInvoiceDate((invoice as any).invoice_date ?? "");
      setDueDate((invoice as any).due_date ?? "");
      setPaymentTermsDays(Number((invoice as any).payment_terms_days ?? 15));
      setTaxPct(Number(invoice.tax_pct ?? 5));
      setCustomerNotes((invoice as any).customer_facing_notes ?? "");
      setInternalNotes((invoice as any).internal_notes ?? "");
      setTerms((invoice as any).terms ?? "");
      setPaymentTerms(invoice.payment_terms ?? "");
      setDepositApplied(Number((invoice as any).deposit_applied ?? 0));
      setSelectedPackageId((invoice as any).selected_package_id ?? "");
    }
  }, [invoice?.id]);

  useEffect(() => {
    const map: Record<string, InvoicePackage> = {};
    packages.forEach((p) => { map[p.id] = p; });
    setPackageState(map);
    if (!selectedPackageId && packages.length > 0) {
      setSelectedPackageId(packages[0].id);
    }
  }, [packages]);

  useEffect(() => {
    const map: Record<string, EditableInvoiceLine[]> = {};
    pkgIds.forEach((pid) => { map[pid] = []; });
    dbItems.forEach((li) => {
      if (!map[li.package_id]) map[li.package_id] = [];
      const { package_id, ...rest } = li;
      map[li.package_id].push(rest as EditableInvoiceLine);
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.display_order - b.display_order));
    setItemsState(map);
  }, [dbItems, pkgIds.join(",")]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading invoice…</div>;
  if (!invoice) return (
    <div className="space-y-3">
      <p className="text-muted-foreground">Invoice not found.</p>
      <Link to="/admin/invoices" className="text-primary hover:underline text-sm">Back</Link>
    </div>
  );

  const isDraft = invoice.status === "Draft";
  const isSent = ["Sent", "Viewed", "Partially Paid", "Overdue"].includes(invoice.status);
  const isPaid = invoice.status === "Paid";
  const isVoid = invoice.status === "Void";
  const isArchived = invoice.status === "Archived";
  const editable = isDraft;
  const customer = customers.find((c) => c.id === customerId);
  const publicUrl = `${window.location.origin}/invoice/${invoice.share_token}`;

  // Payments sum
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Active package totals
  const activePkgId = selectedPackageId || packages[0]?.id;
  const activePkg = packages.find((p) => p.id === activePkgId);
  const activePkgState = activePkgId ? (packageState[activePkgId] || activePkg) : null;
  const activeItems = activePkgId ? (itemsState[activePkgId] || []) : [];

  const totals = computeInvoiceTotals({
    items: activeItems,
    packageDiscount: activePkgState && activePkgState.package_discount_kind !== "none"
      ? { kind: activePkgState.package_discount_kind as any, value: activePkgState.package_discount_value }
      : null,
    manualDiscounts,
    appliedCodes,
    taxPct,
    depositApplied,
    amountPaid: totalPaid,
  });

  const handleSaveAll = async () => {
    await update.mutateAsync({
      id: invoice.id,
      patch: {
        customer_id: customerId || null,
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        payment_terms_days: paymentTermsDays,
        tax_pct: taxPct,
        customer_facing_notes: customerNotes,
        internal_notes: internalNotes,
        terms,
        payment_terms: paymentTerms,
        deposit_applied: depositApplied,
        selected_package_id: selectedPackageId || null,
        // recompute snapshot totals on the row
        services_subtotal: totals.servicesSubtotal,
        products_subtotal: totals.productsSubtotal,
        subtotal: totals.baseSubtotal,
        discount_total: totals.totalDiscount,
        tax_amount: totals.taxAmount,
        total: totals.total,
        amount_paid: totals.amountPaid,
        balance_due: totals.balanceDue,
      },
    });
    for (const p of packages) {
      const local = packageState[p.id];
      if (!local) continue;
      await upsertPkg.mutateAsync({
        id: p.id, invoice_id: invoice.id,
        name: local.name, description: local.description, display_order: local.display_order,
        is_recommended: local.is_recommended,
        package_discount_kind: local.package_discount_kind,
        package_discount_value: local.package_discount_value,
        package_discount_reason: local.package_discount_reason,
      });
      await replaceItems.mutateAsync({
        package_id: p.id,
        items: (itemsState[p.id] || []).map((it) => ({
          item_type: it.item_type, catalog_ref_id: it.catalog_ref_id,
          name: it.name, description: it.description,
          quantity: it.quantity, unit_price: it.unit_price,
          taxable: it.taxable, is_optional: it.is_optional,
          is_selected: it.is_selected, discount_allowed: it.discount_allowed,
          image_url: it.image_url, display_order: it.display_order,
        })),
      });
    }
    toast({ title: "Saved" });
  };

  const handleAddPackage = async () => {
    await upsertPkg.mutateAsync({
      invoice_id: invoice.id,
      name: `Variation ${packages.length + 1}`,
      display_order: packages.length,
    });
  };

  const handleSendLink = async () => {
    if (!customerId) { toast({ title: "Pick a customer first", variant: "destructive" }); return; }
    if (packages.length === 0 || activeItems.length === 0) {
      toast({ title: "Add at least one variation with line items", variant: "destructive" }); return;
    }
    await handleSaveAll();
    await markSent.mutateAsync(invoice.id);
    navigator.clipboard.writeText(publicUrl).catch(() => {});
    toast({ title: "Invoice marked as sent", description: "Public link copied to clipboard." });
  };

  const handleSendEmail = async () => {
    if (!customer?.email) { toast({ title: "Customer has no email", variant: "destructive" }); return; }
    await handleSaveAll();
    sendEmail.mutate(invoice.id);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copied" });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <Link to="/admin/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="page-header">{invoice.invoice_number}</h1>
          <StatusBadge label={invoice.status} variant={STATUS_VARIANT[invoice.status] || "neutral"} />
          {(invoice as any).source_estimate_id && (
            <Link to={`/admin/estimates/${(invoice as any).source_estimate_id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />from estimate
            </Link>
          )}
          {invoice.job_id && (
            <Link to={`/admin/jobs/${invoice.job_id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />view job
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={handleSaveAll} disabled={update.isPending || replaceItems.isPending}>
                <Save className="h-4 w-4 mr-1" />Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleSendLink}>
                <Send className="h-4 w-4 mr-1" />Send (link)
              </Button>
              <Button size="sm" onClick={handleSendEmail} disabled={!customer?.email}>
                <Send className="h-4 w-4 mr-1" />Email customer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                if (!confirm("Delete this draft?")) return;
                del.mutate(invoice.id, { onSuccess: () => navigate("/admin/invoices") });
              }} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {(isSent || isPaid) && (
            <>
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Copy className="h-4 w-4 mr-1" />Copy link
              </Button>
              {!isPaid && (
                <Button size="sm" onClick={() => setPaymentDialog(true)}>
                  <Receipt className="h-4 w-4 mr-1" />Record payment
                </Button>
              )}
              {!isPaid && !isVoid && (
                <Button size="sm" variant="outline" onClick={() => {
                  if (!confirm("Void this invoice? This cannot be undone.")) return;
                  voidInv.mutate({ id: invoice.id });
                }} className="text-destructive">
                  <Ban className="h-4 w-4 mr-1" />Void
                </Button>
              )}
            </>
          )}
          {!isArchived && !isDraft && (
            <Button size="sm" variant="ghost" onClick={() => archiveInv.mutate(invoice.id)}>
              <Archive className="h-4 w-4 mr-1" />Archive
            </Button>
          )}
          {isArchived && (
            <Button size="sm" variant="outline" onClick={() => unarchiveInv.mutate(invoice.id)}>
              <ArchiveRestore className="h-4 w-4 mr-1" />Restore
            </Button>
          )}
        </div>
      </div>

      <WorkflowStepper stages={buildInvoiceStages({
        status: invoice.status,
        source_estimate_id: (invoice as any).source_estimate_id,
        job_id: invoice.job_id,
        sent_at: (invoice as any).sent_at,
        amount_paid: (invoice as any).amount_paid,
        total: (invoice as any).total,
      })} />

      {isVoid && (
        <div className="metric-card flex items-center gap-3 border-destructive/30 bg-destructive/5">
          <Ban className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive font-medium">This invoice has been voided.</p>
        </div>
      )}

      {/* Header card: customer + dates */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-card md:col-span-2 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId} disabled={!editable}>
              <SelectTrigger><SelectValue placeholder="Pick a customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {customer && (
              <p className="text-xs text-muted-foreground mt-1">
                {customer.email || "(no email)"} {customer.phone && `· ${customer.phone}`}<br />
                {customer.serviceAddress.street}, {customer.serviceAddress.city}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Invoice date</Label>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} disabled={!editable} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!editable} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Net days</Label>
            <Input type="number" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(parseInt(e.target.value) || 0)} disabled={!editable} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tax %</Label>
            <Input type="number" step="0.01" value={taxPct} onChange={(e) => setTaxPct(parseFloat(e.target.value) || 0)} disabled={!editable} />
          </div>
        </div>

        {/* From */}
        <div className="metric-card space-y-1">
          <h2 className="section-title">From</h2>
          <p className="font-semibold">{settings?.companyName || "Your company"}</p>
          <p className="text-xs text-muted-foreground whitespace-pre-line">{settings?.companyAddress || "—"}</p>
          <p className="text-xs text-muted-foreground">{settings?.companyEmail}{settings?.companyPhone ? ` · ${settings.companyPhone}` : ""}</p>
        </div>
      </div>

      {/* Variations bar */}
      {packages.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground">Active variation:</span>
          {packages.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={p.id === activePkgId ? "default" : "outline"}
              onClick={() => setSelectedPackageId(p.id)}
            >
              {packageState[p.id]?.name || p.name}
            </Button>
          ))}
        </div>
      )}

      {/* Packages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Variations ({packages.length})</h2>
          {editable && (
            <Button size="sm" variant="outline" onClick={handleAddPackage}>
              <Plus className="h-4 w-4 mr-1" />Add variation
            </Button>
          )}
        </div>
        {packages.map((p) => {
          const local = packageState[p.id] || p;
          const items = itemsState[p.id] || [];
          return (
            <InvoicePackageCard
              key={p.id}
              pkg={local}
              items={items}
              products={products}
              locked={!editable}
              isActive={p.id === activePkgId}
              onPackageChange={(patch) => setPackageState((s) => ({ ...s, [p.id]: { ...local, ...patch } }))}
              onItemsChange={(next) => setItemsState((s) => ({ ...s, [p.id]: next }))}
              onDelete={() => { if (confirm(`Delete "${local.name}"?`)) deletePkg.mutate({ id: p.id, invoice_id: invoice.id }); }}
              onDuplicate={() => dupPkg.mutate({ package_id: p.id, invoice_id: invoice.id })}
              onSetActive={() => setSelectedPackageId(p.id)}
            />
          );
        })}
        {packages.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-6">No variations yet. Add one to begin.</p>
        )}
      </div>

      {/* Discounts & codes */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="metric-card space-y-3">
          <h2 className="section-title">Discount codes</h2>
          <DiscountCodeInput
            applied={appliedCodes as any}
            onApply={(code) => applyCode.mutate({ invoice_id: invoice.id, code })}
            onRemove={(rid) => removeCode.mutate({ id: rid, invoice_id: invoice.id })}
            disabled={!editable}
          />
        </div>
        <div className="metric-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Manual discounts</h2>
            {editable && (
              <Button size="sm" variant="outline" onClick={() => setDiscountDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />Add
              </Button>
            )}
          </div>
          {manualDiscounts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No manual discounts.</p>
          ) : (
            <div className="space-y-1">
              {manualDiscounts.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm bg-warning/5 border border-warning/20 rounded-md px-3 py-1.5">
                  <div>
                    <span className="font-medium">
                      {d.kind === "percent" ? `${d.value}%` : formatCAD(d.value)}
                    </span>
                    {d.reason && <span className="text-xs text-muted-foreground ml-2">— {d.reason}</span>}
                  </div>
                  {editable && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => removeDiscount.mutate({ id: d.id, invoice_id: invoice.id })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deposit applied */}
      <div className="metric-card grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Deposit already collected</Label>
          <Input
            type="number" step="0.01" value={depositApplied}
            onChange={(e) => setDepositApplied(parseFloat(e.target.value) || 0)}
            disabled={!editable}
          />
          <p className="text-xs text-muted-foreground mt-1">Deducted from balance due. Carried over from estimate when converted.</p>
        </div>
        <div className="sm:col-span-2 flex items-end">
          <p className="text-xs text-muted-foreground">
            Payments received: <span className="font-semibold text-foreground">{formatCAD(totalPaid)}</span> across {payments.length} payment(s).
          </p>
        </div>
      </div>

      {/* Totals */}
      <div className="metric-card space-y-2">
        <h2 className="section-title">Totals (active variation)</h2>
        <InvoiceTotals totals={totals} showPayments />
      </div>

      {/* Payments list */}
      <div className="metric-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Payments</h2>
          {(isSent || invoice.status === "Partially Paid") && !isVoid && (
            <Button size="sm" onClick={() => setPaymentDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />Record payment
            </Button>
          )}
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Method</th>
                  <th className="text-left py-2">Reference</th>
                  <th className="text-left py-2">Notes</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td className="py-2">{p.method || "—"}</td>
                    <td className="py-2 font-mono text-xs">{p.reference || "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{p.notes || "—"}</td>
                    <td className="py-2 text-right font-medium">{formatCAD(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes & terms */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="metric-card space-y-2">
          <Label className="text-xs">Notes (visible to customer)</Label>
          <Textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={3} disabled={!editable} />
        </div>
        <div className="metric-card space-y-2">
          <Label className="text-xs">Terms & conditions</Label>
          <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} disabled={!editable} />
        </div>
      </div>

      <div className="metric-card space-y-2">
        <Label className="text-xs">Payment terms / instructions</Label>
        <Textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={2} disabled={!editable}
          placeholder="e.g. Payment due within 15 days. e-Transfers to invoice@yourcompany.com" />
      </div>

      <div className="metric-card space-y-2">
        <Label className="text-xs">Internal notes (not visible to customer)</Label>
        <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} disabled={!editable} />
      </div>

      {(isSent || isPaid) && (
        <div className="metric-card space-y-2">
          <h2 className="section-title">Public link</h2>
          <div className="flex gap-2">
            <Input value={publicUrl} readOnly className="font-mono text-xs" />
            <Button onClick={copyLink} variant="outline" size="sm"><Copy className="h-4 w-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Customers can view this invoice and download a printable copy without signing in.
          </p>
        </div>
      )}

      {!settings?.companyName && (
        <div className="metric-card flex items-start gap-2 border-warning/30 bg-warning/5">
          <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
          <div className="text-xs">
            <p className="font-medium">Company branding not set</p>
            <p className="text-muted-foreground">
              Configure your company name, address and payment instructions in{" "}
              <Link to="/admin/payouts" className="text-primary hover:underline">Settings</Link>.
            </p>
          </div>
        </div>
      )}

      <RecordPaymentDialog
        open={paymentDialog} onOpenChange={setPaymentDialog}
        invoiceId={invoice.id} balanceDue={totals.balanceDue}
      />
      <ManualDiscountDialog
        open={discountDialog} onOpenChange={setDiscountDialog}
        invoiceId={invoice.id}
      />
    </div>
  );
}
