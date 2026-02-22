import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fairnessConfig } from "@/data/mockData";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const tooltips: Record<string, string> = {
  rollingWindow: "The number of days over which fairness distribution is calculated.",
  maxSharePercent: "Maximum percentage of total jobs any single SP should receive.",
  cooldownHours: "Minimum hours between consecutive assignments to the same SP.",
  minDistributionBoost: "Score boost applied to under-allocated SPs to rebalance distribution.",
  newSpBoostDays: "Number of days new SPs receive a boost to help them get established.",
};

export default function FairnessControls() {
  const [config, setConfig] = useState({ ...fairnessConfig });
  const [saved, setSaved] = useState(false);

  const fields: { key: keyof typeof config; label: string; unit: string; min: number; max: number }[] = [
    { key: "rollingWindow", label: "Rolling Window", unit: "days", min: 7, max: 90 },
    { key: "maxSharePercent", label: "Maximum Share %", unit: "%", min: 5, max: 50 },
    { key: "cooldownHours", label: "Cooldown After Assignment", unit: "hours", min: 0, max: 48 },
    { key: "minDistributionBoost", label: "Minimum Distribution Boost", unit: "points", min: 0, max: 20 },
    { key: "newSpBoostDays", label: "New SP Boost Duration", unit: "days", min: 0, max: 90 },
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-header">Fairness Controls</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure fairness distribution parameters</p>
      </div>

      <div className="metric-card space-y-6">
        {fields.map(({ key, label, unit, min, max }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{label}</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{tooltips[key]}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={min}
                max={max}
                value={config[key]}
                onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <Button
        className="w-full sm:w-auto"
        onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
      >
        {saved ? "✓ Saved" : "Save Fairness Config"}
      </Button>
    </div>
  );
}
