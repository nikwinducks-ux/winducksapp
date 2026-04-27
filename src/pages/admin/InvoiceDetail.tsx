import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  useCustomerInvoice,
  useCustomerInvoiceLineItems,
  useSaveInvoice,
  useSendInvoiceEmail,
  useMarkInvoiceSent,
  useMarkInvoicePaid,
  useDeleteInvoice,
  type CustomerInvoiceLineItem,
} from "@/hooks/useCustomerInvoices";
import { useCustomers, useAppSettings } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCAD } from "@/lib/currency";
import {
  ArrowLeft, Plus, Trash2, Send, Save, Link2, CheckCircle2, FileText, Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "valid" | "warning" | "error"> = {
  Draft: "neutral", Sent: "info", Paid: "valid", Overdue: "warning", Cancelled: "error",
};

interface EditableLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  display_order: number;
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: invoice, isLoading } = useCustomerInvoice(id);
  const { data: dbLines = [] } = useCustomerInvoiceLineItems(id);
  const { data: customers = [] } = useCustomers();
  const { data: settings } = useAppSettings();

  const saveInvoice = useSaveInvoice();
  const sendEmail = useSendInvoiceEmail();
  const markSent = useMarkInvoiceSent();
  const markPaid = useMarkInvoicePaid();
  const deleteInvoice = useDeleteInvoice();

  const [lines, setLines] = useState<EditableLine[]>([]);
  const [taxPct, setTaxPct] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  // Hydrate state when invoice/line items load
  useEffect(() => {
    if (invoice) {
      setTaxPct(Number(invoice.tax_pct ?? 0));
      setNotes(invoice.notes ?? "");
      setPaymentTerms(invoice.payment_terms ?? "");
    }
  }, [invoice?.id]);

  useEffect(() => {
    setLines(
      dbLines.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        line_total: Number(l.line_total),
        display_order: l.display_order,
      })),
    );
  }, [dbLines]);

  const customer = useMemo(
    () => customers.find((c) => c.id === invoice?.customer_id),
    [customers, invoice?.customer_id],
  );

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.line_total || 0), 0),
    [lines],
  );
  const taxAmount = useMemo(
    () => Math.round(subtotal * (Number(taxPct) || 0)) / 100,
    [subtotal, taxPct],
  );
  const total = subtotal + taxAmount;

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading invoice…</div>;
  }
  if (!invoice) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Link to="/admin/invoices" className="text-primary hover:underline text-sm">Back to Invoices</Link>
      </div>
    );
  }

  const isDraft = invoice.status === "Draft";
  const isSent = invoice.status === "Sent" || invoice.status === "Overdue";
  const isPaid = invoice.status === "Paid";
  const publicUrl = `${window.location.origin}/invoice/${invoice.share_token}`;

  const updateLine = (idx: number, patch: Partial<EditableLine>) => {
    setLines((prev) => {
      const next = [...prev];
      const l = { ...next[idx], ...patch };
      l.line_total = Math.round(Number(l.quantity || 0) * Number(l.unit_price || 0) * 100) / 100;
      next[idx] = l;
      return next;
    });
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        description: "",
        quantity: 1,
        unit_price: 0,
        line_total: 0,
        display_order: prev.length,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    saveInvoice.mutate({
      invoiceId: invoice.id,
      patch: { tax_pct: taxPct, notes, payment_terms: paymentTerms },
      lineItems: lines,
    });
  };

  const handleSendEmail = async () => {
    // Save first
    await saveInvoice.mutateAsync({
      invoiceId: invoice.id,
      patch: { tax_pct: taxPct, notes, payment_terms: paymentTerms },
      lineItems: lines,
    });
    sendEmail.mutate(invoice.id);
  };

  const handleMarkSent = async () => {
    await saveInvoice.mutateAsync({
      invoiceId: invoice.id,
      patch: { tax_pct: taxPct, notes, payment_terms: paymentTerms },
      lineItems: lines,
    });
    markSent.mutate(invoice.id);
  };

  const handleMarkPaid = () => {
    markPaid.mutate({
      invoiceId: invoice.id,
      method: paymentMethod || "Manual",
      reference: paymentReference,
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    deleteInvoice.mutate(invoice.id, {
      onSuccess: () => navigate("/admin/invoices"),
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link copied", description: "Public invoice URL copied to clipboard." });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <Link to="/admin/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="page-header">{invoice.invoice_number}</h1>
          <StatusBadge label={invoice.status} variant={STATUS_VARIANT[invoice.status] || "neutral"} />
        </div>
        <div className="flex flex-wrap gap-2">
          {invoice.job_id && (
            <Link to={`/admin/jobs/${invoice.job_id}`}>
              <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" />View Job</Button>
            </Link>
          )}
          {(isSent || isPaid) && (
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-1" />Copy public link
            </Button>
          )}
          {isDraft && (
            <>
              <Button size="sm" variant="outline" onClick={handleSave} disabled={saveInvoice.isPending}>
                <Save className="h-4 w-4 mr-1" />Save draft
              </Button>
              <Button size="sm" variant="outline" onClick={handleMarkSent} disabled={markSent.isPending}>
                <Link2 className="h-4 w-4 mr-1" />Mark as sent (link only)
              </Button>
              <Button size="sm" onClick={handleSendEmail} disabled={sendEmail.isPending || !customer?.email}>
                <Send className="h-4 w-4 mr-1" />
                {sendEmail.isPending ? "Sending..." : "Email & mark sent"}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {isSent && (
            <Button size="sm" onClick={handleMarkPaid} disabled={markPaid.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Mark paid
            </Button>
          )}
        </div>
      </div>

      {/* Bill To / From */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="metric-card space-y-2">
          <h2 className="section-title">From</h2>
          <p className="font-semibold">{settings?.companyName || "Your Company"}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {settings?.companyAddress || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {settings?.companyEmail} {settings?.companyPhone && `· ${settings.companyPhone}`}
          </p>
          {!settings?.companyName && (
            <Link to="/admin/payouts" className="text-xs text-primary hover:underline">
              Set up company branding →
            </Link>
          )}
        </div>
        <div className="metric-card space-y-2">
          <h2 className="section-title">Bill To</h2>
          {customer ? (
            <>
              <p className="font-semibold">{customer.name}</p>
              <p className="text-sm text-muted-foreground">
                {customer.serviceAddress.street}<br />
                {customer.serviceAddress.city}, {customer.serviceAddress.province} {customer.serviceAddress.postalCode}
              </p>
              <p className="text-xs text-muted-foreground">
                {customer.email || "(no email)"} {customer.phone && `· ${customer.phone}`}
              </p>
              {!customer.email && (
                <p className="text-xs text-warning">
                  ⚠ No email on file — emailing the invoice will fail. You can still share the public link.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No customer linked.</p>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="metric-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Line items</h2>
          {isDraft && (
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />Add line
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit price</div>
            <div className="col-span-2 text-right">Line total</div>
          </div>
          {lines.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No line items yet.</p>
          )}
          {lines.map((line, idx) => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-6"
                value={line.description}
                onChange={(e) => updateLine(idx, { description: e.target.value })}
                placeholder="Description"
                disabled={!isDraft}
              />
              <Input
                className="col-span-2 text-right"
                type="number"
                step="0.01"
                value={line.quantity}
                onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                disabled={!isDraft}
              />
              <Input
                className="col-span-2 text-right"
                type="number"
                step="0.01"
                value={line.unit_price}
                onChange={(e) => updateLine(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                disabled={!isDraft}
              />
              <div className="col-span-2 flex items-center justify-end gap-1">
                <span className="font-medium text-sm">{formatCAD(line.line_total)}</span>
                {isDraft && (
                  <Button size="sm" variant="ghost" onClick={() => removeLine(idx)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCAD(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm items-center gap-2">
            <span className="text-muted-foreground">
              Tax ({" "}
              <Input
                type="number"
                step="0.01"
                value={taxPct}
                onChange={(e) => setTaxPct(parseFloat(e.target.value) || 0)}
                className="inline-block w-16 h-7 text-right"
                disabled={!isDraft}
              />
              {" "}%)
            </span>
            <span className="font-medium">{formatCAD(taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{formatCAD(total)}</span>
          </div>
        </div>
      </div>

      {/* Notes & terms */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="metric-card space-y-2">
          <Label>Payment terms</Label>
          <Textarea
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            rows={3}
            placeholder="Payment due within 15 days."
            disabled={!isDraft}
          />
        </div>
        <div className="metric-card space-y-2">
          <Label>Notes (visible to customer)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Thank you for your business!"
            disabled={!isDraft}
          />
        </div>
      </div>

      {/* Payment recording */}
      {isSent && (
        <div className="metric-card space-y-3">
          <h2 className="section-title">Record Payment</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="e.g. Cash, e-Transfer, Card"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reference</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transaction ID / cheque #"
              />
            </div>
          </div>
        </div>
      )}

      {isPaid && (
        <div className="metric-card flex items-center gap-3 bg-success/5 border-success/30">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div className="flex-1">
            <p className="font-medium text-success">Paid</p>
            <p className="text-xs text-muted-foreground">
              {invoice.paid_at && new Date(invoice.paid_at).toLocaleString()}
              {invoice.payment_method && ` · ${invoice.payment_method}`}
              {invoice.payment_reference && ` · Ref: ${invoice.payment_reference}`}
            </p>
          </div>
        </div>
      )}

      {/* Public link */}
      {(isSent || isPaid) && (
        <div className="metric-card space-y-2">
          <h2 className="section-title">Public link</h2>
          <div className="flex gap-2">
            <Input value={publicUrl} readOnly className="font-mono text-xs" />
            <Button onClick={copyLink} variant="outline" size="sm"><Copy className="h-4 w-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Customers can view (and download a printable copy) without logging in.
          </p>
        </div>
      )}
    </div>
  );
}
