// Pure totals calculator for invoice packages.
// Same math as estimateTotals — invoices and estimates share computation rules.

export type ItemType = "service" | "product";

export interface InvoiceLineItemLike {
  id: string;
  item_type: ItemType | string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
  is_optional: boolean;
  is_selected: boolean;
  discount_allowed: boolean;
}

export interface ManualDiscountLike {
  id: string;
  scope: "invoice" | "package" | "line" | string;
  package_id?: string | null;
  line_item_id?: string | null;
  kind: "percent" | "fixed" | string;
  value: number;
  reason?: string;
}

export interface AppliedCodeLike {
  id: string;
  kind: "percent" | "fixed" | string;
  value: number;
  applies_to: "all" | "services" | "products" | string;
  code_snapshot?: string;
}

export interface InvoiceTotalsInput {
  items: InvoiceLineItemLike[];
  packageDiscount?: { kind: "none" | "percent" | "fixed"; value: number } | null;
  manualDiscounts?: ManualDiscountLike[]; // invoice-wide
  appliedCodes?: AppliedCodeLike[];
  taxPct: number;
  depositApplied?: number; // already collected before invoice
  amountPaid?: number;     // sum of payments recorded on the invoice
}

export interface InvoiceTotalsOutput {
  servicesSubtotal: number;
  productsSubtotal: number;
  requiredSubtotal: number;
  optionalSelectedSubtotal: number;
  baseSubtotal: number;
  packageDiscountAmount: number;
  manualDiscountAmount: number;
  codeDiscountAmount: number;
  totalDiscount: number;
  taxableBase: number;
  taxAmount: number;
  total: number;
  depositApplied: number;
  amountPaid: number;
  balanceDue: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotalsOutput {
  const items = input.items.filter((i) => i.is_selected || !i.is_optional);

  let services = 0;
  let products = 0;
  let required = 0;
  let optional = 0;
  let taxableBase = 0;

  for (const it of items) {
    const line = Number(it.quantity || 0) * Number(it.unit_price || 0);
    if (it.item_type === "product") products += line;
    else services += line;
    if (it.is_optional) optional += line;
    else required += line;
    if (it.taxable) taxableBase += line;
  }

  const baseSubtotal = services + products;

  let packageDiscountAmount = 0;
  if (input.packageDiscount && input.packageDiscount.kind !== "none") {
    if (input.packageDiscount.kind === "percent") {
      packageDiscountAmount = round2(baseSubtotal * (Number(input.packageDiscount.value) || 0) / 100);
    } else {
      packageDiscountAmount = round2(Number(input.packageDiscount.value) || 0);
    }
  }

  let manualDiscountAmount = 0;
  for (const d of input.manualDiscounts || []) {
    if (d.scope !== "invoice") continue;
    if (d.kind === "percent") {
      manualDiscountAmount += round2(baseSubtotal * (Number(d.value) || 0) / 100);
    } else {
      manualDiscountAmount += round2(Number(d.value) || 0);
    }
  }

  let codeDiscountAmount = 0;
  for (const c of input.appliedCodes || []) {
    let base = baseSubtotal;
    if (c.applies_to === "services") base = services;
    if (c.applies_to === "products") base = products;
    if (c.kind === "percent") {
      codeDiscountAmount += round2(base * (Number(c.value) || 0) / 100);
    } else {
      codeDiscountAmount += round2(Number(c.value) || 0);
    }
  }

  const totalDiscount = round2(packageDiscountAmount + manualDiscountAmount + codeDiscountAmount);
  const discountRatio = baseSubtotal > 0 ? totalDiscount / baseSubtotal : 0;
  const adjustedTaxable = Math.max(0, taxableBase - taxableBase * discountRatio);

  const taxPct = Number(input.taxPct || 0);
  const taxAmount = round2(adjustedTaxable * taxPct / 100);
  const total = Math.max(0, round2(baseSubtotal - totalDiscount + taxAmount));

  const depositApplied = Math.max(0, Number(input.depositApplied || 0));
  const amountPaid = Math.max(0, Number(input.amountPaid || 0));
  const balanceDue = Math.max(0, round2(total - depositApplied - amountPaid));

  return {
    servicesSubtotal: round2(services),
    productsSubtotal: round2(products),
    requiredSubtotal: round2(required),
    optionalSelectedSubtotal: round2(optional),
    baseSubtotal: round2(baseSubtotal),
    packageDiscountAmount: round2(packageDiscountAmount),
    manualDiscountAmount: round2(manualDiscountAmount),
    codeDiscountAmount: round2(codeDiscountAmount),
    totalDiscount,
    taxableBase: round2(adjustedTaxable),
    taxAmount,
    total: round2(total),
    depositApplied: round2(depositApplied),
    amountPaid: round2(amountPaid),
    balanceDue,
  };
}
