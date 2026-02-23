import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle } from "lucide-react";
import { useServiceCategories } from "@/hooks/useSupabaseData";

export default function AutoAcceptSettings() {
  const [enabled, setEnabled] = useState(true);
  const [maxDistance, setMaxDistance] = useState(25);
  const [minPayout, setMinPayout] = useState(100);
  const [maxJobsPerDay, setMaxJobsPerDay] = useState(5);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({});
  const [blockAboveTarget, setBlockAboveTarget] = useState(true);
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data: allCategories = [], isLoading: categoriesLoading } = useServiceCategories();
  const activeCategories = allCategories
    .filter((c) => c.active)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

  // Initialize selections once categories load
  useEffect(() => {
    if (activeCategories.length > 0 && !initialized) {
      const initial: Record<string, boolean> = {};
      activeCategories.forEach((cat) => {
        initial[cat.name] = false;
      });
      setSelectedCategories(initial);
      setInitialized(true);
    }
  }, [activeCategories, initialized]);

  // Keep selections in sync when categories change (new ones added)
  useEffect(() => {
    if (initialized && activeCategories.length > 0) {
      setSelectedCategories((prev) => {
        const updated = { ...prev };
        // Add new categories
        activeCategories.forEach((cat) => {
          if (!(cat.name in updated)) {
            updated[cat.name] = false;
          }
        });
        return updated;
      });
    }
  }, [activeCategories, initialized]);

  // Find saved categories that are now inactive
  const inactiveSelected = Object.keys(selectedCategories).filter(
    (name) => selectedCategories[name] && !activeCategories.some((c) => c.name === name)
  );

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-header">Auto-Accept Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure automatic job acceptance rules</p>
      </div>

      {/* Warning Banner */}
      {enabled && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <AlertCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Auto-Accept may result in immediate job assignments.</p>
            <p className="text-xs text-muted-foreground mt-1">Jobs matching your criteria will be automatically accepted without manual review.</p>
          </div>
        </div>
      )}

      {/* Toggle */}
      <div className="metric-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Auto-Accept Enabled</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Automatically accept matching job offers</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {enabled && (
        <>
          {/* Criteria */}
          <div className="metric-card space-y-4">
            <h2 className="section-title">Acceptance Criteria</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Maximum Distance (km)</Label>
                <Input type="number" min={1} max={100} value={maxDistance} onChange={(e) => setMaxDistance(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Minimum Payout ($)</Label>
                <Input type="number" min={0} value={minPayout} onChange={(e) => setMinPayout(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Max Jobs Per Day</Label>
                <Input type="number" min={1} max={10} value={maxJobsPerDay} onChange={(e) => setMaxJobsPerDay(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="metric-card space-y-4">
            <h2 className="section-title">Allowed Service Categories</h2>
            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground">Loading categories…</p>
            ) : activeCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active service categories found.</p>
            ) : (
              <div className="space-y-3">
                {activeCategories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-3 cursor-pointer">
                    <Switch
                      checked={selectedCategories[cat.name] ?? false}
                      onCheckedChange={(v) =>
                        setSelectedCategories((prev) => ({ ...prev, [cat.name]: v }))
                      }
                    />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </label>
                ))}
                {/* Show inactive saved categories */}
                {inactiveSelected.map((name) => (
                  <label key={name} className="flex items-center gap-3 cursor-pointer opacity-60">
                    <Switch
                      checked={true}
                      onCheckedChange={(v) =>
                        setSelectedCategories((prev) => ({ ...prev, [name]: v }))
                      }
                    />
                    <span className="text-sm font-medium">{name} <span className="text-xs text-muted-foreground">(Inactive)</span></span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Fairness Block */}
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title">Fairness Override</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Do not auto-accept if Fairness Status is "Above Target"</p>
              </div>
              <Switch checked={blockAboveTarget} onCheckedChange={setBlockAboveTarget} />
            </div>
          </div>
        </>
      )}

      <Button
        className="w-full sm:w-auto"
        onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
      >
        {saved ? "✓ Saved" : "Save Settings"}
      </Button>
    </div>
  );
}
