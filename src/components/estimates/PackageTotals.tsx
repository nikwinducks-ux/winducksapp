import { formatCAD } from "@/lib/currency";
import type { PackageTotalsOutput } from "@/lib/estimateTotals";

export function PackageTotals({ totals, depositKind, compact }: {
  totals: PackageTotalsOutput;
  depositKind?: "none" | "fixed" | "percent";
  compact?: boolean;
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
        <Row label="Package discount" value={-totals.packageDiscountAmount} negative />
      )}
      {totals.estimateDiscountAmount > 0 && (
        <Row label="Estimate discount" value={-totals.estimateDiscountAmount} negative />
      )}
      {totals.codeDiscountAmount > 0 && (
        <Row label="Discount codes" value={-totals.codeDiscountAmount} negative />
      )}
      <Row label="Tax" value={totals.taxAmount} />
      <div className="border-t my-1" />
      <div className="flex justify-between text-base">
        <span className="font-semibold">Total</span>
        <span className="font-bold text-primary">{formatCAD(totals.total)}</span>
      </div>
      {depositKind && depositKind !== "none" && totals.depositDue > 0 && (
        <>
          <Row label="Deposit due now" value={totals.depositDue} highlight />
          <Row label="Balance due" value={totals.balanceDue} muted />
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold, negative, muted, highlight }: {
  label: string; value: number; bold?: boolean; negative?: boolean; muted?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground text-xs" : ""}`}>
      <span className={bold ? "font-medium" : ""}>{label}</span>
      <span className={
        negative ? "text-destructive" :
        highlight ? "font-semibold text-warning" :
        bold ? "font-medium" : ""
      }>
        {negative ? `-${formatCAD(Math.abs(value))}` : formatCAD(value)}
      </span>
    </div>
  );
}
