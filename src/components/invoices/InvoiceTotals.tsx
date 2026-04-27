import { formatCAD } from "@/lib/currency";
import type { InvoiceTotalsOutput } from "@/lib/invoiceTotals";

export function InvoiceTotals({ totals, showPayments }: {
  totals: InvoiceTotalsOutput;
  showPayments?: boolean;
}) {
  return (
    <div className="space-y-1.5 text-sm">
      <Row label="Services" value={totals.servicesSubtotal} />
      <Row label="Products" value={totals.productsSubtotal} />
      {totals.optionalSelectedSubtotal > 0 && (
        <Row label="Optional add-ons (selected)" value={totals.optionalSelectedSubtotal} muted />
      )}
      <div className="border-t my-1" />
      <Row label="Subtotal" value={totals.baseSubtotal} bold />
      {totals.packageDiscountAmount > 0 && (
        <Row label="Variation discount" value={-totals.packageDiscountAmount} negative />
      )}
      {totals.manualDiscountAmount > 0 && (
        <Row label="Manual discount" value={-totals.manualDiscountAmount} negative />
      )}
      {totals.codeDiscountAmount > 0 && (
        <Row label="Discount codes" value={-totals.codeDiscountAmount} negative />
      )}
      <Row label="Tax" value={totals.taxAmount} />
      <div className="border-t my-1" />
      <div className="flex justify-between text-base">
        <span className="font-semibold">Invoice total</span>
        <span className="font-bold text-primary">{formatCAD(totals.total)}</span>
      </div>
      {showPayments && (
        <>
          {totals.depositApplied > 0 && (
            <Row label="Deposit applied" value={-totals.depositApplied} negative />
          )}
          {totals.amountPaid > 0 && (
            <Row label="Payments received" value={-totals.amountPaid} negative />
          )}
          <div className="flex justify-between text-base border-t pt-1.5 mt-1">
            <span className="font-semibold">Balance due</span>
            <span className={`font-bold ${totals.balanceDue <= 0 ? "text-success" : "text-warning"}`}>
              {formatCAD(totals.balanceDue)}
            </span>
          </div>
        </>
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
