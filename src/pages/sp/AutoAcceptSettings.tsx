import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle } from "lucide-react";
import { useServiceCategories, useServiceProvider } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AutoAcceptSettings() {
  const { user } = useAuth();
  const spId = user?.spId ?? null;
  const { data: currentSp, isLoading: spLoading } = useServiceProvider(spId ?? undefined);
  const { data: allCategories = [], isLoading: categoriesLoading } = useServiceCategories();
  const activeCategories = allCategories
    .filter((c) => c.active)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

  const { toast } = useToast();
  const qc = useQueryClient();

  // Local form state — initialized from DB
  const [enabled, setEnabled] = useState(false);
  const [maxDistance, setMaxDistance] = useState(25);
  const [minPayout, setMinPayout] = useState(100);
  const [maxJobsPerDay, setMaxJobsPerDay] = useState(5);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({});
  const [blockAboveTarget, setBlockAboveTarget] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize from DB when SP loads
  useEffect(() => {
    if (currentSp && !initialized) {
      setEnabled(currentSp.autoAccept);
      setMaxDistance(currentSp.travelRadius);
      setMaxJobsPerDay(currentSp.maxJobsPerDay);
      // Initialize category selections based on SP's current categories
      const catMap: Record<string, boolean> = {};
      activeCategories.forEach((cat) => {
        catMap[cat.name] = currentSp.serviceCategories.includes(cat.name);
      });
      setSelectedCategories(catMap);
      setInitialized(true);
    }
  }, [currentSp, activeCategories, initialized]);

  // Keep selections in sync when new categories are added
  useEffect(() => {
    if (initialized && activeCategories.length > 0) {
      setSelectedCategories((prev) => {
        const updated = { ...prev };
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

  const handleSave = async () => {
    if (!spId) return;
    setSaving(true);
    try {
      // The single source of truth is the service_providers table
      const allowedCategories = Object.entries(selectedCategories)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const { error } = await supabase.from("service_providers").update({
        auto_accept: enabled,
        service_radius_km: maxDistance,
        max_jobs_per_day: maxJobsPerDay,
        categories: allowedCategories,
      }).eq("id", spId);

      if (error) throw error;

      // Invalidate queries so diagnostics refresh immediately
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Settings saved", description: "Auto-accept settings updated." });
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (spLoading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>;
  if (!spId) return <p className="text-sm text-muted-foreground p-4">No linked SP account found.</p>;

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
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}
