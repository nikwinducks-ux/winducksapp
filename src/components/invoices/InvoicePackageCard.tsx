import { useState } from "react";
import { Plus, Trash2, GripVertical, Star, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCAD } from "@/lib/currency";
import type { InvoiceLineItem, InvoicePackage } from "@/hooks/useInvoices";
import type { Product } from "@/hooks/useProducts";

export interface EditableInvoiceLine extends Omit<InvoiceLineItem, "package_id"> {}

export function InvoicePackageCard({
  pkg, items, products, locked, isActive,
  onPackageChange, onItemsChange, onDelete, onDuplicate, onSetActive,
}: {
  pkg: InvoicePackage;
  items: EditableInvoiceLine[];
  products: Product[];
  locked: boolean;
  isActive: boolean;
  onPackageChange: (patch: Partial<InvoicePackage>) => void;
  onItemsChange: (items: EditableInvoiceLine[]) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetActive: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const updateItem = (idx: number, patch: Partial<EditableInvoiceLine>) => {
    const next = [...items]; next[idx] = { ...next[idx], ...patch }; onItemsChange(next);
  };
  const addItem = (type: "service" | "product" = "service") => {
    onItemsChange([
      ...items,
      {
        id: `tmp-${Date.now()}-${Math.random()}`,
        item_type: type, catalog_ref_id: null,
        name: "", description: "", quantity: 1, unit_price: 0,
        taxable: true, is_optional: false, is_selected: true, discount_allowed: true,
        image_url: "", display_order: items.length,
      },
    ]);
  };
  const removeItem = (idx: number) => onItemsChange(items.filter((_, i) => i !== idx));
  const duplicateItem = (idx: number) => {
    const src = items[idx];
    const next = [...items];
    next.splice(idx + 1, 0, { ...src, id: `tmp-${Date.now()}-${Math.random()}` });
    onItemsChange(next);
  };
  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onItemsChange(next);
  };
  const pickProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId); if (!p) return;
    updateItem(idx, {
      catalog_ref_id: p.id, item_type: "product",
      name: p.name, description: p.description,
      unit_price: Number(p.unit_price), taxable: p.taxable, image_url: p.image_url || "",
    });
  };

  return (
    <div className={`metric-card space-y-4 ${isActive ? "ring-2 ring-primary/50" : ""}`}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="mt-2 text-muted-foreground hover:text-foreground" aria-label="Toggle">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <GripVertical className="h-4 w-4 mt-2 text-muted-foreground" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={pkg.name}
              onChange={(e) => onPackageChange({ name: e.target.value })}
              className="font-semibold text-base max-w-xs"
              placeholder="Variation name (e.g., Full invoice, Deposit, Final)"
              disabled={locked}
            />
            {isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                <Star className="h-3 w-3 fill-current" /> Active
              </span>
            )}
            <div className="ml-auto flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={onSetActive} disabled={locked} title="Make this the active variation">
                <Star className={`h-4 w-4 ${isActive ? "fill-primary text-primary" : ""}`} />
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onDuplicate} disabled={locked} title="Duplicate variation">
                <Copy className="h-4 w-4" />
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onDelete} disabled={locked} className="text-destructive" title="Delete variation">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Textarea
            value={pkg.description}
            onChange={(e) => onPackageChange({ description: e.target.value })}
            placeholder="Variation description (visible to customer)"
            rows={2} disabled={locked}
          />
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Line items</Label>
              {!locked && (
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => addItem("service")}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Service
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addItem("product")}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Product
                  </Button>
                </div>
              )}
            </div>

            {items.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-2">No line items yet.</p>
            )}

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="rounded-md border bg-muted/20 p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 sm:col-span-2">
                      <Select
                        value={item.item_type}
                        onValueChange={(v) => updateItem(idx, { item_type: v, catalog_ref_id: null })}
                        disabled={locked}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="service">Service</SelectItem>
                          <SelectItem value="product">Product</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {item.item_type === "product" && products.length > 0 && (
                      <div className="col-span-12 sm:col-span-3">
                        <Select
                          value={item.catalog_ref_id ?? "_custom"}
                          onValueChange={(v) => v !== "_custom" && pickProduct(idx, v)}
                          disabled={locked}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="Pick product" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_custom">Custom</SelectItem>
                            {products.filter((p) => p.active).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Input
                      className={`col-span-12 ${item.item_type === "product" && products.length > 0 ? "sm:col-span-7" : "sm:col-span-10"}`}
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      placeholder="Item name" disabled={locked}
                    />
                  </div>
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder="Description (optional)" rows={1} className="text-sm" disabled={locked}
                  />
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-[10px] text-muted-foreground">Qty</Label>
                      <Input type="number" step="0.01" value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        className="h-9 text-right" disabled={locked} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-[10px] text-muted-foreground">Unit price</Label>
                      <Input type="number" step="0.01" value={item.unit_price}
                        onChange={(e) => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                        className="h-9 text-right" disabled={locked} />
                    </div>
                    <div className="col-span-4 sm:col-span-2 text-right">
                      <Label className="text-[10px] text-muted-foreground">Line total</Label>
                      <p className="font-semibold pt-2">{formatCAD(item.quantity * item.unit_price)}</p>
                    </div>
                    <div className="col-span-12 sm:col-span-6 flex items-center gap-3 flex-wrap text-xs justify-end">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox checked={item.taxable} onCheckedChange={(c) => updateItem(idx, { taxable: !!c })} disabled={locked} /> Taxable
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox checked={item.is_optional} onCheckedChange={(c) => updateItem(idx, { is_optional: !!c })} disabled={locked} /> Optional
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox checked={item.is_selected} onCheckedChange={(c) => updateItem(idx, { is_selected: !!c })} disabled={locked} /> Selected
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox checked={item.discount_allowed} onCheckedChange={(c) => updateItem(idx, { discount_allowed: !!c })} disabled={locked} /> Discountable
                      </label>
                      {!locked && (
                        <div className="flex gap-1">
                          <Button type="button" size="sm" variant="ghost" onClick={() => moveItem(idx, -1)} className="h-7 w-7 p-0">↑</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => moveItem(idx, 1)} className="h-7 w-7 p-0">↓</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => duplicateItem(idx)} className="h-7 w-7 p-0">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(idx)} className="h-7 w-7 p-0 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4 sm:col-span-3">
              <Label className="text-xs">Variation discount</Label>
              <Select
                value={pkg.package_discount_kind}
                onValueChange={(v) => onPackageChange({ package_discount_kind: v })}
                disabled={locked}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                  <SelectItem value="fixed">Fixed ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pkg.package_discount_kind !== "none" && (
              <>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-xs">Value</Label>
                  <Input type="number" step="0.01" value={pkg.package_discount_value}
                    onChange={(e) => onPackageChange({ package_discount_value: parseFloat(e.target.value) || 0 })}
                    className="h-9" disabled={locked} />
                </div>
                <div className="col-span-12 sm:col-span-7">
                  <Label className="text-xs">Reason</Label>
                  <Input value={pkg.package_discount_reason}
                    onChange={(e) => onPackageChange({ package_discount_reason: e.target.value })}
                    className="h-9" disabled={locked} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
