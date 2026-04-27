import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, X } from "lucide-react";
import type { AppliedCode } from "@/hooks/useEstimates";
import { formatCAD } from "@/lib/currency";

export function DiscountCodeInput({
  applied, onApply, onRemove, disabled,
}: {
  applied: AppliedCode[];
  onApply: (code: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="DISCOUNT CODE"
          className="font-mono uppercase"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => { if (code.trim()) { onApply(code.trim()); setCode(""); } }}
          disabled={disabled || !code.trim()}
        >
          <Tag className="h-4 w-4 mr-1" />Apply
        </Button>
      </div>
      <div className="space-y-1">
        {applied.map((a) => (
          <div key={a.id} className="flex items-center justify-between text-sm bg-primary/5 border border-primary/20 rounded-md px-3 py-1.5">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono font-medium">{a.code_snapshot}</span>
              <span className="text-xs text-muted-foreground">
                {a.kind === "percent" ? `${a.value}%` : formatCAD(a.value)}
                {" · "}{a.applies_to}
              </span>
            </div>
            {!disabled && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(a.id)} className="h-7 w-7 p-0">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
