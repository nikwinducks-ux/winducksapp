import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DepositConfig({ kind, value, onChange, disabled }: {
  kind: "none" | "fixed" | "percent";
  value: number;
  onChange: (kind: "none" | "fixed" | "percent", value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Deposit type</Label>
        <Select value={kind} onValueChange={(v) => onChange(v as any, value)} disabled={disabled}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No deposit</SelectItem>
            <SelectItem value="fixed">Fixed ($)</SelectItem>
            <SelectItem value="percent">Percent (%)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {kind !== "none" && (
        <div className="space-y-1">
          <Label className="text-xs">Amount</Label>
          <Input
            type="number" step="0.01"
            value={value}
            onChange={(e) => onChange(kind, parseFloat(e.target.value) || 0)}
            className="h-9"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
