import { Star } from "lucide-react";
import type { ServiceProvider } from "@/data/mockData";
import { Label } from "@/components/ui/label";

export interface CrewPickerValue {
  spId: string;
  isLead: boolean;
}

interface CrewPickerProps {
  providers: ServiceProvider[];
  value: CrewPickerValue[];
  onChange: (next: CrewPickerValue[]) => void;
  payout: number;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  maxHeightClass?: string;
}

/**
 * Multi-select SP crew picker with Lead toggle and live per-SP payout split.
 * Shared by Job Detail, Job Form, and Calendar sheet.
 */
export function CrewPicker({
  providers,
  value,
  onChange,
  payout,
  disabled = false,
  label = "Crew Members",
  helperText,
  maxHeightClass = "max-h-64",
}: CrewPickerProps) {
  const selectedIds = new Set(value.map((v) => v.spId));
  const leadId = value.find((v) => v.isLead)?.spId ?? value[0]?.spId ?? null;

  const toggle = (spId: string, checked: boolean) => {
    if (disabled) return;
    if (checked) {
      const next = [...value, { spId, isLead: false }];
      // If no lead yet, this becomes lead
      if (!next.some((m) => m.isLead)) next[next.length - 1].isLead = true;
      onChange(next);
    } else {
      const filtered = value.filter((m) => m.spId !== spId);
      // If we removed the lead, promote the first remaining
      if (filtered.length > 0 && !filtered.some((m) => m.isLead)) {
        filtered[0] = { ...filtered[0], isLead: true };
      }
      onChange(filtered);
    }
  };

  const setLead = (spId: string) => {
    if (disabled) return;
    onChange(value.map((m) => ({ ...m, isLead: m.spId === spId })));
  };

  const activeProviders = providers.filter((sp) => sp.status === "Active");
  const perSp = value.length > 0 ? payout / value.length : 0;

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm">{label}</Label>}
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      <div className={`${maxHeightClass} overflow-y-auto border rounded-md divide-y bg-background`}>
        {activeProviders.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">No active service providers.</p>
        )}
        {activeProviders.map((sp) => {
          const checked = selectedIds.has(sp.id);
          const isLead = leadId === sp.id;
          return (
            <div key={sp.id} className="flex items-center gap-3 p-2 hover:bg-muted/50">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => toggle(sp.id, e.target.checked)}
                className="h-4 w-4 cursor-pointer"
                id={`crew-${sp.id}`}
              />
              <label htmlFor={`crew-${sp.id}`} className="flex-1 text-sm cursor-pointer">
                {sp.name} — {sp.baseAddress.city} · {sp.travelRadius}km
              </label>
              {checked && (
                <button
                  type="button"
                  disabled={disabled || isLead}
                  onClick={() => setLead(sp.id)}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${
                    isLead
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                  title={isLead ? "Lead SP" : "Make lead"}
                >
                  <Star className={`h-3 w-3 ${isLead ? "fill-current" : ""}`} />
                  {isLead ? "Lead" : ""}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {value.length > 1 && payout > 0 && (
        <p className="text-xs text-muted-foreground">
          Each SP will be paid ${perSp.toFixed(2)} (= ${payout} ÷ {value.length})
        </p>
      )}
      {value.length === 1 && payout > 0 && (
        <p className="text-xs text-muted-foreground">
          {activeProviders.find((sp) => sp.id === value[0].spId)?.name ?? "SP"} will be paid ${payout.toFixed(2)}
        </p>
      )}
    </div>
  );
}
