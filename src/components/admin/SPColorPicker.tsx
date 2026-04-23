import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PALETTE_KEYS, PALETTE_BY_KEY, PALETTE_LABELS, type PaletteKey } from "@/components/calendar/spColors";

interface SPColorPickerProps {
  value?: string | null;
  onChange: (key: PaletteKey | null) => void;
  disabled?: boolean;
}

export function SPColorPicker({ value, onChange, disabled }: SPColorPickerProps) {
  const current = value && (PALETTE_KEYS as readonly string[]).includes(value) ? (value as PaletteKey) : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(null)}
        className={cn(
          "h-8 px-3 rounded-md border text-xs font-medium transition-colors",
          current === null
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-foreground border-border hover:bg-accent",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        title="Use auto-assigned color"
      >
        Auto
      </button>
      {PALETTE_KEYS.map((key) => {
        const isActive = current === key;
        const swatch = PALETTE_BY_KEY[key].swatch;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(key)}
            title={PALETTE_LABELS[key]}
            aria-label={PALETTE_LABELS[key]}
            aria-pressed={isActive}
            className={cn(
              "relative h-8 w-8 rounded-md border-2 transition-all flex items-center justify-center",
              swatch,
              isActive ? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background" : "border-border/40 hover:scale-110",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {isActive && <Check className="h-4 w-4 text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}
