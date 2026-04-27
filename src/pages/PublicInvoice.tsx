import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchInvoiceByToken } from "@/hooks/useCustomerInvoices";
import { formatCAD } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";

export default function PublicInvoice() {
  const { token } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public_invoice", token],
    enabled: !!token,
    queryFn: () => fetchInvoiceByToken(token!),
  });

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
  const items: Array<any> = payload.line_items ?? [];

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto bg-card rounded-lg shadow-sm print:shadow-none print:rounded-none p-8 space-y-8">
        {/* Print toolbar */}
        <div className="flex justify-between items-start gap-4 print:hidden">
          <p className="text-xs text-muted-foreground">Public invoice</p>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />Print / Save PDF
          </Button>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start gap-6 flex-wrap">
          <div className="space-y-1">
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
              Issued {inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : "—"}
            </p>
            <p className="text-xs">
              Status: <span className="font-semibold">{inv.status}</span>
            </p>
          </div>
        </div>

        {/* Bill to */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Bill to</p>
          <p className="font-semibold">{customer.name || "Customer"}</p>
          <p className="text-sm text-muted-foreground">
            {customer.address_street}<br />
            {[customer.address_city, customer.address_region, customer.address_postal].filter(Boolean).join(", ")}
          </p>
          {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
        </div>

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
              {items.map((l, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2.5">{l.description}</td>
                  <td className="py-2.5 text-right">{Number(l.quantity)}</td>
                  <td className="py-2.5 text-right">{formatCAD(l.unit_price)}</td>
                  <td className="py-2.5 text-right font-medium">{formatCAD(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCAD(inv.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({Number(inv.tax_pct)}%)</span>
              <span>{formatCAD(inv.tax_amount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-1">
              <span className="font-semibold">Total Due</span>
              <span className="text-xl font-bold">{formatCAD(inv.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes / terms */}
        {(inv.payment_terms || inv.notes) && (
          <div className="border-t pt-4 space-y-3 text-sm">
            {inv.payment_terms && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Payment terms</p>
                <p className="whitespace-pre-line">{inv.payment_terms}</p>
              </div>
            )}
            {inv.notes && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-line">{inv.notes}</p>
              </div>
            )}
          </div>
        )}

        {inv.paid_at && (
          <div className="rounded-md bg-success/10 border border-success/30 p-3 text-sm text-success font-medium">
            Paid on {new Date(inv.paid_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}
