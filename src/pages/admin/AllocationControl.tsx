import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { allocationWeights } from "@/data/mockData";

interface WeightConfig {
  availability: number;
  proximity: number;
  competency: number;
  jobHistory: number;
  customerRating: number;
  reliability: number;
  responsiveness: number;
  safetyCompliance: number;
  fairness: number;
}

const labels: Record<keyof WeightConfig, string> = {
  availability: "Availability Weight",
  proximity: "Proximity Weight",
  competency: "Competency Weight",
  jobHistory: "Job History Weight",
  customerRating: "Customer Rating Weight",
  reliability: "Reliability Weight",
  responsiveness: "Responsiveness Weight",
  safetyCompliance: "Safety / Compliance Weight",
  fairness: "Fairness Weight",
};

export default function AllocationControl() {
  const [weights, setWeights] = useState<WeightConfig>({
    availability: allocationWeights.availability,
    proximity: allocationWeights.proximity,
    competency: allocationWeights.competency,
    jobHistory: allocationWeights.jobHistory,
    customerRating: allocationWeights.customerRating,
    reliability: allocationWeights.reliability,
    responsiveness: allocationWeights.responsiveness,
    safetyCompliance: allocationWeights.safetyCompliance,
    fairness: allocationWeights.fairness,
  });
  const [policyVersion, setPolicyVersion] = useState(allocationWeights.policyVersion);
  const [saved, setSaved] = useState(false);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalized = Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, total > 0 ? Math.round((v / total) * 100) : 0])
  ) as unknown as WeightConfig;

  const updateWeight = (key: keyof WeightConfig, value: number[]) => {
    setWeights({ ...weights, [key]: value[0] });
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <div>
        <h1 className="page-header">Allocation Control Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure scoring weights for SP allocation</p>
      </div>

      <div className="metric-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Current Policy</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{policyVersion}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPolicyVersion("Policy v0.9")}>
              Revert to Previous
            </Button>
          </div>
        </div>
      </div>

      <div className="metric-card space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Scoring Weights</h2>
          <div className="text-sm">
            Total: <span className={`font-bold ${total === 100 ? "text-success" : "text-warning"}`}>{total}</span>
            <span className="text-muted-foreground"> / 100</span>
          </div>
        </div>

        {(Object.keys(labels) as (keyof WeightConfig)[]).map((key) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{labels[key]}</Label>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold w-8 text-right">{weights[key]}</span>
                <span className="text-muted-foreground text-xs w-12 text-right">({normalized[key]}%)</span>
              </div>
            </div>
            <Slider
              value={[weights[key]]}
              onValueChange={(v) => updateWeight(key, v)}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        ))}
      </div>

      <Button
        className="w-full sm:w-auto"
        onClick={() => {
          setPolicyVersion(`Policy v${(parseFloat(policyVersion.replace("Policy v", "")) + 0.1).toFixed(1)}`);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      >
        {saved ? "✓ Policy Saved" : "Save New Policy Version"}
      </Button>
    </div>
  );
}
