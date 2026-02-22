import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { serviceProviders } from "@/data/mockData";
import { useRole } from "@/contexts/RoleContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AvailabilitySettings() {
  const { currentSpId } = useRole();
  const sp = serviceProviders.find((s) => s.id === currentSpId)!;

  const [schedule, setSchedule] = useState(
    DAYS.map((day) => ({
      day,
      enabled: day !== "Sunday",
      start: "08:00",
      end: "17:00",
    }))
  );
  const [maxJobs, setMaxJobs] = useState(sp.maxJobsPerDay);
  const [travelRadius, setTravelRadius] = useState(sp.travelRadius);
  const [blackoutDates, setBlackoutDates] = useState<string[]>(["2026-03-15", "2026-04-10"]);
  const [saved, setSaved] = useState(false);

  const toggleDay = (idx: number) => {
    const next = [...schedule];
    next[idx].enabled = !next[idx].enabled;
    setSchedule(next);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-header">Availability Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure your weekly schedule and capacity</p>
      </div>

      {/* Weekly Schedule */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Weekly Schedule</h2>
        <div className="space-y-3">
          {schedule.map((s, i) => (
            <div key={s.day} className="flex items-center gap-4">
              <div className="w-28 flex items-center gap-2">
                <Switch checked={s.enabled} onCheckedChange={() => toggleDay(i)} />
                <span className={`text-sm font-medium ${!s.enabled ? "text-muted-foreground" : ""}`}>{s.day}</span>
              </div>
              {s.enabled && (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={s.start}
                    onChange={(e) => {
                      const next = [...schedule];
                      next[i].start = e.target.value;
                      setSchedule(next);
                    }}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={s.end}
                    onChange={(e) => {
                      const next = [...schedule];
                      next[i].end = e.target.value;
                      setSchedule(next);
                    }}
                    className="w-32"
                  />
                </div>
              )}
              {!s.enabled && <span className="text-sm text-muted-foreground">Off</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Capacity */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Capacity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Max Jobs Per Day</Label>
            <Input type="number" min={1} max={10} value={maxJobs} onChange={(e) => setMaxJobs(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Travel Radius (km)</Label>
            <Input type="number" min={5} max={100} value={travelRadius} onChange={(e) => setTravelRadius(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Blackout Dates */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Blackout Dates</h2>
        <div className="space-y-2">
          {blackoutDates.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input type="date" value={d} onChange={(e) => {
                const next = [...blackoutDates];
                next[i] = e.target.value;
                setBlackoutDates(next);
              }} className="w-48" />
              <Button variant="ghost" size="sm" onClick={() => setBlackoutDates(blackoutDates.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setBlackoutDates([...blackoutDates, ""])}>Add Date</Button>
        </div>
      </div>

      {/* Service Categories */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Service Categories</h2>
        <div className="flex flex-wrap gap-2">
          {["Window Cleaning", "Gutter Cleaning", "Pressure Washing"].map((cat) => (
            <label key={cat} className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-accent transition-colors">
              <input type="checkbox" defaultChecked={sp.serviceCategories.includes(cat)} className="accent-primary" />
              <span className="text-sm">{cat}</span>
            </label>
          ))}
        </div>
      </div>

      <Button
        className="w-full sm:w-auto"
        onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
      >
        {saved ? "✓ Saved" : "Save Settings"}
      </Button>
    </div>
  );
}
