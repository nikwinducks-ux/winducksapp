// Pure totals calculator for estimate packages.
// Used in admin builder, public customer view, and to derive the
// number sent to the customer_accept_estimate RPC.

export type ItemType = "service" | "product";

export interface EstimateLineItemLike {
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
  scope: "estimate" | "package" | string;
  package_id?: string | null;
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

export interface PackageTotalsInput {
  items: EstimateLineItemLike[];
  packageDiscount?: { kind: "none" | "percent" | "fixed"; value: number } | null;
  estimateDiscounts?: ManualDiscountLike[]; // estimate-wide manual discounts
  appliedCodes?: AppliedCodeLike[];
  taxPct: number;
  depositKind?: "none" | "fixed" | "percent";
  depositValue?: number;
}

export interface PackageTotalsOutput {
  servicesSubtotal: number;
  productsSubtotal: number;
  requiredSubtotal: number;
  optionalSelectedSubtotal: number;
  baseSubtotal: number;
  packageDiscountAmount: number;
  estimateDiscountAmount: number;
  codeDiscountAmount: number;
  totalDiscount: number;
  taxableBase: number;
  taxAmount: number;
  total: number;
  depositDue: number;
  balanceDue: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computePackageTotals(input: PackageTotalsInput): PackageTotalsOutput {
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

  // Package-level discount
  let packageDiscountAmount = 0;
  if (input.packageDiscount && input.packageDiscount.kind !== "none") {
    if (input.packageDiscount.kind === "percent") {
      packageDiscountAmount = round2(baseSubtotal * (Number(input.packageDiscount.value) || 0) / 100);
    } else {
      packageDiscountAmount = round2(Number(input.packageDiscount.value) || 0);
    }
  }

  // Estimate-wide manual discounts (sum)
  let estimateDiscountAmount = 0;
  for (const d of input.estimateDiscounts || []) {
    if (d.scope !== "estimate") continue;
    if (d.kind === "percent") {
      estimateDiscountAmount += round2(baseSubtotal * (Number(d.value) || 0) / 100);
    } else {
      estimateDiscountAmount += round2(Number(d.value) || 0);
    }
  }

  // Applied discount codes
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

  const totalDiscount = round2(packageDiscountAmount + estimateDiscountAmount + codeDiscountAmount);

  // Apply discounts proportionally to taxable base too
  const discountRatio = baseSubtotal > 0 ? totalDiscount / baseSubtotal : 0;
  const adjustedTaxable = Math.max(0, taxableBase - taxableBase * discountRatio);

  const taxPct = Number(input.taxPct || 0);
  const taxAmount = round2(adjustedTaxable * taxPct / 100);

  const total = Math.max(0, round2(baseSubtotal - totalDiscount + taxAmount));

  let depositDue = 0;
  if (input.depositKind === "fixed") depositDue = round2(Number(input.depositValue || 0));
  if (input.depositKind === "percent") depositDue = round2(total * Number(input.depositValue || 0) / 100);
  depositDue = Math.min(depositDue, total);

  return {
    servicesSubtotal: round2(services),
    productsSubtotal: round2(products),
    requiredSubtotal: round2(required),
    optionalSelectedSubtotal: round2(optional),
    baseSubtotal: round2(baseSubtotal),
    packageDiscountAmount: round2(packageDiscountAmount),
    estimateDiscountAmount: round2(estimateDiscountAmount),
    codeDiscountAmount: round2(codeDiscountAmount),
    totalDiscount,
    taxableBase: round2(adjustedTaxable),
    taxAmount,
    total: round2(total),
    depositDue: round2(depositDue),
    balanceDue: round2(total - depositDue),
  };
}
