import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceCategory, ServiceCategoryLineItem } from "@/hooks/useSupabaseData";
import { formatCAD } from "@/lib/currency";

export interface ServiceLineItem {
  service_category: string;
  quantity: number;
  unit_price: string;
  notes: string;
  /** UI-only: tracks which catalog line item populated this row (not persisted). */
  line_item_id?: string;
}

interface Props {
  items: ServiceLineItem[];
  onChange: (items: ServiceLineItem[]) => void;
  activeCategories: ServiceCategory[];
}

const CUSTOM_VALUE = "__custom__";

function useLineItemsForCategory(categoryId: string | undefined) {
  return useQuery({
    queryKey: ["service_category_line_items", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("service_category_line_items" as any)
        .select("*")
        .eq("category_id", categoryId)
        .eq("active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ServiceCategoryLineItem[];
    },
    enabled: !!categoryId,
  });
}

interface RowProps {
  index: number;
  item: ServiceLineItem;
  activeCategories: ServiceCategory[];
  onChange: (next: ServiceLineItem) => void;
  onRemove: () => void;
}

function ServiceLineRow({ index, item, activeCategories, onChange, onRemove }: RowProps) {
  const category = activeCategories.find((c) => c.name === item.service_category);
  const { data: lineItems = [] } = useLineItemsForCategory(category?.id);

  const handleCategoryChange = (name: string) => {
    onChange({
      service_category: name,
      quantity: item.quantity,
      unit_price: "",
      notes: "",
      line_item_id: undefined,
    });
  };

  const handleLineItemChange = (value: string) => {
    if (value === CUSTOM_VALUE) {
      onChange({ ...item, line_item_id: undefined });
      return;
    }
    const li = lineItems.find((l) => l.id === value);
    if (!li) return;
    const titleLabel = li.title || li.description || "";
    const noteText = li.title && li.description ? `${li.title} (${li.description})` : titleLabel;
    onChange({
      ...item,
      line_item_id: li.id,
      unit_price: String(li.price ?? ""),
      notes: noteText,
    });
  };

  const lineTotal = (() => {
    const price = parseFloat(item.unit_price);
    if (isNaN(price)) return 0;
    return item.quantity * price;
  })();

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Service #{index + 1}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Category</Label>
          <Select value={item.service_category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {activeCategories.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Line item</Label>
          <Select
            value={item.line_item_id ?? CUSTOM_VALUE}
            onValueChange={handleLineItemChange}
            disabled={!category}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={category ? "Pick from catalog..." : "Select a category first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CUSTOM_VALUE}>— Custom —</SelectItem>
              {lineItems.map((li) => (
                <SelectItem key={li.id} value={li.id}>
                  {(li.title || li.description) + " · " + formatCAD(li.price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {category && lineItems.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              No saved items —{" "}
              <Link to={`/admin/categories/${category.id}`} className="text-primary hover:underline">
                manage in Service Categories
              </Link>
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Qty</Label>
          <Input
            type="number"
            min={1}
            className="h-9"
            value={item.quantity}
            onChange={(e) => onChange({ ...item, quantity: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unit Price (CAD)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-9"
            placeholder="0.00"
            value={item.unit_price}
            onChange={(e) => onChange({ ...item, unit_price: e.target.value, line_item_id: undefined })}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Notes (optional)"
          className="h-8 text-xs flex-1"
          value={item.notes}
          onChange={(e) => onChange({ ...item, notes: e.target.value })}
        />
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          = {formatCAD(lineTotal)}
        </span>
      </div>
    </div>
  );
}

export function JobServiceLineItems({ items, onChange, activeCategories }: Props) {
  const updateItemAt = (index: number, next: ServiceLineItem) => {
    const updated = [...items];
    updated[index] = next;
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, { service_category: "", quantity: 1, unit_price: "", notes: "" }]);
  };

  const totalAmount = items.reduce((sum, item) => {
    const price = parseFloat(item.unit_price);
    if (isNaN(price)) return sum;
    return sum + item.quantity * price;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Services</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Service
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No services added. Click "Add Service" to begin.
        </p>
      )}

      {items.map((item, index) => (
        <ServiceLineRow
          key={index}
          index={index}
          item={item}
          activeCategories={activeCategories}
          onChange={(next) => updateItemAt(index, next)}
          onRemove={() => removeItem(index)}
        />
      ))}

      {items.length > 0 && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="text-lg font-bold text-primary">{formatCAD(totalAmount)}</span>
        </div>
      )}
    </div>
  );
}
