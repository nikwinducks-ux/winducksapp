import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAllocationPolicies, useActivePolicy, useSavePolicy, useActivatePolicy } from "@/hooks/useAllocationData";
import type { AllocationWeights } from "@/lib/allocation-engine";

const labels: Record<keyof AllocationWeights, string> = {
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
  const activePolicy = useActivePolicy();
  const { data: allPolicies = [] } = useAllocationPolicies();
  const savePolicy = useSavePolicy();
  const activatePolicy = useActivatePolicy();

  const [weights, setWeights] = useState<AllocationWeights>({
    availability: 20, proximity: 15, competency: 15, jobHistory: 10,
    customerRating: 15, reliability: 10, responsiveness: 5, safetyCompliance: 5, fairness: 5,
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (activePolicy && !initialized) {
      setWeights(activePolicy.weights_json);
      setInitialized(true);
    }
  }, [activePolicy, initialized]);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalized = Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, total > 0 ? Math.round((v / total) * 100) : 0])
  ) as unknown as AllocationWeights;

  const updateWeight = (key: keyof AllocationWeights, value: number[]) => {
    setWeights({ ...weights, [key]: value[0] });
  };

  const handleSave = () => {
    const currentVersion = activePolicy?.version_name ?? "Policy v1.0";
    const vNum = parseFloat(currentVersion.replace("Policy v", "")) || 1.0;
    const newVersion = `Policy v${(vNum + 0.1).toFixed(1)}`;

    savePolicy.mutate({
      versionName: newVersion,
      weights,
      fairness: activePolicy?.fairness_json ?? {
        rollingWindow: 30, maxSharePercent: 15, cooldownHours: 4,
        minDistributionBoost: 5, newSpBoostDays: 30,
      },
    });
  };

  const previousPolicy = allPolicies.find((p) => !p.active);

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
            <p className="text-sm text-muted-foreground mt-0.5">
              {activePolicy?.version_name ?? "No policy"} • {allPolicies.length} version(s)
            </p>
          </div>
          {previousPolicy && (
            <Button variant="outline" size="sm" onClick={() => activatePolicy.mutate(previousPolicy.id)}>
              Revert to {previousPolicy.version_name}
            </Button>
          )}
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

        {(Object.keys(labels) as (keyof AllocationWeights)[]).map((key) => (
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

      <Button className="w-full sm:w-auto" onClick={handleSave} disabled={savePolicy.isPending}>
        {savePolicy.isPending ? "Saving…" : "Save New Policy Version"}
      </Button>
    </div>
  );
}
