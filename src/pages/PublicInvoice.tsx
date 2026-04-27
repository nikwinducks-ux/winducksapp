import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchInvoiceByToken } from "@/hooks/useCustomerInvoices";
import { markInvoiceViewedByToken } from "@/hooks/useInvoices";
import { formatCAD } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Mail, Phone, MapPin, AlertTriangle } from "lucide-react";
import { computeInvoiceTotals } from "@/lib/invoiceTotals";

export default function PublicInvoice() {
  const { token } = useParams();
  const [showPayInfo, setShowPayInfo] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public_invoice", token],
    enabled: !!token,
    queryFn: () => fetchInvoiceByToken(token!),
  });

  useEffect(() => {
    if (token && data && !(data as any).error) {
      markInvoiceViewedByToken(token).catch(() => {});
    }
  }, [token, data]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading invoice…</div>;
  }

  const payload = data as any;
  if (error || !payload || payload.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-2 max-w-md">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold">Invoice unavailable</h1>
          <p className="text-sm text-muted-foreground">
            {payload?.error || "The link may be invalid or the invoice has not been sent yet."}
          </p>
        </div>
      </div>
    );
  }

  const inv = payload.invoice ?? {};
  const company = payload.company ?? {};
  const customer = payload.customer ?? {};
  const packages: Array<any> = payload.packages ?? [];
  const legacyItems: Array<any> = payload.legacy_line_items ?? [];
  const payments: Array<any> = payload.payments ?? [];
  const manualDiscounts: Array<any> = payload.manual_discounts ?? [];
  const appliedCodes: Array<any> = payload.applied_codes ?? [];
  const paymentInstructions: string = payload.payment_instructions || "";

  // Pick the selected package (or first)
  const selectedPkgId = inv.selected_package_id;
  const activePkg = packages.find((p) => p.package?.id === selectedPkgId) ?? packages[0];
  const items: any[] = activePkg?.items ?? [];

  // Recompute totals live for accuracy (snapshot also exists on row)
  const totals = computeInvoiceTotals({
    items: items.map((it) => ({
      id: it.id, item_type: it.item_type, name: it.name, description: it.description,
      quantity: Number(it.quantity), unit_price: Number(it.unit_price),
      taxable: it.taxable, is_optional: it.is_optional, is_selected: it.is_selected,
      discount_allowed: it.discount_allowed,
    })),
    packageDiscount: activePkg?.package?.package_discount_kind && activePkg.package.package_discount_kind !== "none"
      ? { kind: activePkg.package.package_discount_kind, value: Number(activePkg.package.package_discount_value) }
      : null,
    manualDiscounts: manualDiscounts.map((d: any) => ({
      id: d.id, scope: d.scope, package_id: d.package_id, line_item_id: d.line_item_id,
      kind: d.kind, value: Number(d.value), reason: d.reason,
    })),
    appliedCodes: appliedCodes.map((c: any) => ({
      id: c.id, kind: c.kind, value: Number(c.value), applies_to: c.applies_to, code_snapshot: c.code_snapshot,
    })),
    taxPct: Number(inv.tax_pct || 0),
    depositApplied: Number(inv.deposit_applied || 0),
    amountPaid: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
  });

  // Fallback for legacy invoices with no packages
  const useLegacy = packages.length === 0 && legacyItems.length > 0;

  const balanceDue = useLegacy ? Number(inv.total) - Number(inv.amount_paid || 0) : totals.balanceDue;
  const isPaid = inv.status === "Paid" || balanceDue <= 0;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !isPaid && inv.due_date && inv.due_date < today;

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto bg-card rounded-lg shadow-sm print:shadow-none print:rounded-none p-6 sm:p-8 space-y-8">
        {/* Print toolbar */}
        <div className="flex justify-between items-start gap-4 print:hidden flex-wrap">
          <p className="text-xs text-muted-foreground">Public invoice · {inv.invoice_number}</p>
          <div className="flex gap-2">
            {!isPaid && (
              <Button size="sm" onClick={() => setShowPayInfo(true)}>
                Request payment instructions
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start gap-6 flex-wrap">
          <div className="space-y-1 min-w-0">
            {company.company_logo_url && (
              <img src={company.company_logo_url} alt="Company logo" className="h-12 mb-2" />
            )}
            <p className="text-lg font-bold">{company.company_name || "Company"}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{company.company_address}</p>
            <p className="text-xs text-muted-foreground">
              {company.company_email}{company.company_phone ? ` · ${company.company_phone}` : ""}
            </p>
          </div>
          <div className="text-right space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">INVOICE</h1>
            <p className="text-sm font-mono">{inv.invoice_number}</p>
            <p className="text-xs text-muted-foreground">
              Issued {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : (inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : "—")}
            </p>
            {inv.due_date && (
              <p className={`text-xs ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                Due {new Date(inv.due_date).toLocaleDateString()}
                {isOverdue && " · OVERDUE"}
              </p>
            )}
            <p className="text-xs">
              Status: <span className="font-semibold">{inv.status}</span>
            </p>
          </div>
        </div>

        {/* Bill to */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Bill to</p>
            <p className="font-semibold">{customer.name || "Customer"}</p>
            <p className="text-sm text-muted-foreground">
              {inv.billing_address_street || customer.address_street}<br />
              {[inv.billing_address_city || customer.address_city, inv.billing_address_region || customer.address_region, inv.billing_address_postal || customer.address_postal].filter(Boolean).join(", ")}
            </p>
            {customer.email && <p className="text-xs text-muted-foreground mt-1"><Mail className="h-3 w-3 inline" /> {customer.email}</p>}
          </div>
          {(inv.service_address_street || inv.service_address_city) && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Service address</p>
              <p className="text-sm">
                <MapPin className="h-3 w-3 inline mr-1" />
                {inv.service_address_street}<br />
                {[inv.service_address_city, inv.service_address_region, inv.service_address_postal].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* Variation name */}
        {!useLegacy && activePkg?.package?.name && packages.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Billing</p>
            <p className="font-semibold">{activePkg.package.name}</p>
            {activePkg.package.description && (
              <p className="text-sm text-muted-foreground">{activePkg.package.description}</p>
            )}
          </div>
        )}

        {/* Line items */}
        <div>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Unit</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {useLegacy ? (
                legacyItems.map((l: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2.5">{l.description}</td>
                    <td className="py-2.5 text-right">{Number(l.quantity)}</td>
                    <td className="py-2.5 text-right">{formatCAD(l.unit_price)}</td>
                    <td className="py-2.5 text-right font-medium">{formatCAD(l.line_total)}</td>
                  </tr>
                ))
              ) : (
                items
                  .filter((it: any) => it.is_selected || !it.is_optional)
                  .map((it: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="flex items-start gap-2">
                          {it.image_url && (
                            <img src={it.image_url} alt="" className="h-10 w-10 rounded object-cover hidden sm:block" />
                          )}
                          <div>
                            <p className="font-medium">
                              {it.name}
                              {it.item_type === "product" && (
                                <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">Product</span>
                              )}
                            </p>
                            {it.description && (
                              <p className="text-xs text-muted-foreground whitespace-pre-line">{it.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-right align-top">{Number(it.quantity)}</td>
                      <td className="py-2.5 text-right align-top">{formatCAD(it.unit_price)}</td>
                      <td className="py-2.5 text-right align-top font-medium">
                        {formatCAD(Number(it.quantity) * Number(it.unit_price))}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-1.5 text-sm">
            {useLegacy ? (
              <>
                <Row label="Subtotal" value={Number(inv.subtotal)} />
                <Row label={`Tax (${Number(inv.tax_pct)}%)`} value={Number(inv.tax_amount)} />
                <div className="flex justify-between border-t pt-2 mt-1 text-base">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">{formatCAD(inv.total)}</span>
                </div>
              </>
            ) : (
              <>
                {totals.servicesSubtotal > 0 && <Row label="Services" value={totals.servicesSubtotal} muted />}
                {totals.productsSubtotal > 0 && <Row label="Products" value={totals.productsSubtotal} muted />}
                <Row label="Subtotal" value={totals.baseSubtotal} bold />
                {totals.packageDiscountAmount > 0 && <Row label="Variation discount" value={-totals.packageDiscountAmount} negative />}
                {totals.manualDiscountAmount > 0 && <Row label="Discounts" value={-totals.manualDiscountAmount} negative />}
                {totals.codeDiscountAmount > 0 && <Row label="Promo code" value={-totals.codeDiscountAmount} negative />}
                <Row label={`Tax (${Number(inv.tax_pct)}%)`} value={totals.taxAmount} />
                <div className="flex justify-between border-t pt-2 mt-1 text-base">
                  <span className="font-semibold">Invoice total</span>
                  <span className="font-bold">{formatCAD(totals.total)}</span>
                </div>
                {totals.depositApplied > 0 && <Row label="Deposit applied" value={-totals.depositApplied} negative />}
                {totals.amountPaid > 0 && <Row label="Payments received" value={-totals.amountPaid} negative />}
                <div className={`flex justify-between border-t pt-2 mt-1 text-lg ${isPaid ? "text-success" : isOverdue ? "text-destructive" : ""}`}>
                  <span className="font-semibold">{isPaid ? "Paid" : "Balance due"}</span>
                  <span className="font-bold">{formatCAD(balanceDue)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payments history */}
        {payments.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Payments received</p>
            <table className="w-full text-sm">
              <tbody>
                {payments.map((p: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5">{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td className="py-1.5 text-muted-foreground">{p.method || "—"}</td>
                    <td className="py-1.5 text-right font-medium">{formatCAD(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes / terms */}
        {(inv.payment_terms || inv.customer_facing_notes || inv.terms || inv.notes) && (
          <div className="border-t pt-4 space-y-3 text-sm">
            {inv.customer_facing_notes && (
              <Section label="Notes">{inv.customer_facing_notes}</Section>
            )}
            {inv.notes && !inv.customer_facing_notes && (
              <Section label="Notes">{inv.notes}</Section>
            )}
            {inv.payment_terms && (
              <Section label="Payment terms">{inv.payment_terms}</Section>
            )}
            {inv.terms && (
              <Section label="Terms & conditions">{inv.terms}</Section>
            )}
          </div>
        )}

        {isPaid && inv.paid_at && (
          <div className="rounded-md bg-success/10 border border-success/30 p-3 text-sm text-success font-medium">
            Paid in full on {new Date(inv.paid_at).toLocaleDateString()}
          </div>
        )}

        {isOverdue && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            This invoice is overdue. Please settle it as soon as possible.
          </div>
        )}
      </div>

      {/* Pay info dialog (manual) */}
      {showPayInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">Payment instructions</h2>
            <div className="text-sm space-y-2 whitespace-pre-line">
              {paymentInstructions ? (
                paymentInstructions
              ) : (
                <>
                  <p>Please contact us to arrange payment for invoice <strong>{inv.invoice_number}</strong>.</p>
                  <div className="rounded-md bg-muted/40 p-3 space-y-1 text-xs">
                    {company.company_email && (
                      <p><Mail className="h-3 w-3 inline mr-1" />{company.company_email}</p>
                    )}
                    {company.company_phone && (
                      <p><Phone className="h-3 w-3 inline mr-1" />{company.company_phone}</p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Amount due</p>
              <p className="text-2xl font-bold">{formatCAD(balanceDue)}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPayInfo(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, negative, muted }: {
  label: string; value: number; bold?: boolean; negative?: boolean; muted?: boolean;
}) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground text-xs" : ""}`}>
      <span className={bold ? "font-medium" : ""}>{label}</span>
      <span className={negative ? "text-destructive" : bold ? "font-medium" : ""}>
        {negative ? `-${formatCAD(Math.abs(value))}` : formatCAD(value)}
      </span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="whitespace-pre-line">{children}</p>
    </div>
  );
}
