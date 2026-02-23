import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { ServiceCategory } from "@/hooks/useSupabaseData";

export interface ServiceLineItem {
  service_category: string;
  quantity: number;
  unit_price: string;
  notes: string;
}

interface Props {
  items: ServiceLineItem[];
  onChange: (items: ServiceLineItem[]) => void;
  activeCategories: ServiceCategory[];
}

export function JobServiceLineItems({ items, onChange, activeCategories }: Props) {
  const updateItem = (index: number, field: keyof ServiceLineItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, { service_category: "", quantity: 1, unit_price: "", notes: "" }]);
  };

  const getLineTotal = (item: ServiceLineItem) => {
    const price = parseFloat(item.unit_price);
    if (isNaN(price)) return 0;
    return item.quantity * price;
  };

  const totalAmount = items.reduce((sum, item) => sum + getLineTotal(item), 0);

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
        <div key={index} className="border rounded-lg p-3 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Service #{index + 1}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Category</Label>
              <Select value={item.service_category} onValueChange={(v) => updateItem(index, "service_category", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qty</Label>
              <Input type="number" min={1} className="h-9" value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit Price ($)</Label>
              <Input type="number" min={0} step="0.01" className="h-9" placeholder="0.00" value={item.unit_price}
                onChange={(e) => updateItem(index, "unit_price", e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Input placeholder="Notes (optional)" className="h-8 text-xs flex-1 mr-3"
              value={item.notes} onChange={(e) => updateItem(index, "notes", e.target.value)} />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              = ${getLineTotal(item).toFixed(2)}
            </span>
          </div>
        </div>
      ))}

      {items.length > 0 && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="text-lg font-bold text-primary">${totalAmount.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
