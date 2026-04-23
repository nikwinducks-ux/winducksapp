import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSpUnavailableBlocks,
  useCreateSpUnavailable,
  useUpdateSpUnavailable,
  useDeleteSpUnavailable,
  type SpUnavailableBlock,
} from "@/hooks/useSpUnavailable";
import UnavailableDialog, { type UnavailableDialogValue } from "@/components/calendar/UnavailableDialog";
import { Plus, Trash2 } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface DaySchedule {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
}

interface Props {
  spId: string;
}

export default function SPAvailabilityEditor({ spId }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const defaultSchedule: DaySchedule[] = DAYS.map((day) => ({
    day,
    enabled: day !== "Sunday",
    start: "08:00",
    end: "17:00",
  }));

  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);
  const [maxJobs, setMaxJobs] = useState(5);
  const [travelRadius, setTravelRadius] = useState(30);
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load existing availability
  const { data: availability, isLoading } = useQuery({
    queryKey: ["sp_availability", spId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sp_availability")
        .select("*")
        .eq("sp_id", spId)
        .maybeSingle();
      return data;
    },
  });

  // Load SP defaults for max_jobs / radius
  const { data: spRow } = useQuery({
    queryKey: ["sp_row_avail", spId],
    queryFn: async () => {
      const { data } = await supabase.from("service_providers").select("max_jobs_per_day, service_radius_km").eq("id", spId).single();
      return data;
    },
  });

  useEffect(() => {
    if (loaded) return;
    if (availability) {
      const sched = availability.schedule_json as any[];
      if (Array.isArray(sched) && sched.length > 0) setSchedule(sched);
      setBlackoutDates(availability.blackout_dates ?? []);
      setMaxJobs(availability.max_jobs_per_day);
      setTravelRadius(availability.travel_radius_km);
      setLoaded(true);
    } else if (spRow && !isLoading) {
      setMaxJobs(spRow.max_jobs_per_day);
      setTravelRadius(spRow.service_radius_km);
      setLoaded(true);
    }
  }, [availability, spRow, isLoading, loaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sp_id: spId,
        schedule_json: schedule as any,
        blackout_dates: blackoutDates.filter(Boolean),
        max_jobs_per_day: maxJobs,
        travel_radius_km: travelRadius,
      };

      // Upsert
      const { error } = await supabase
        .from("sp_availability")
        .upsert(payload, { onConflict: "sp_id" });
      if (error) throw error;

      // Also sync to service_providers table
      await supabase.from("service_providers").update({
        max_jobs_per_day: maxJobs,
        service_radius_km: travelRadius,
      }).eq("id", spId);

      // Audit log
      await supabase.from("availability_events").insert({
        sp_id: spId,
        changed_by_user_id: user?.id ?? null,
        changes_json: payload as any,
        note: user?.role === "admin" ? "Updated by admin" : "Updated by SP",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sp_availability", spId] });
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Availability saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleDay = (idx: number) => {
    const next = [...schedule];
    next[idx].enabled = !next[idx].enabled;
    setSchedule(next);
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading availability...</div>;

  return (
    <div className="space-y-6 mt-4">
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

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? "Saving..." : "Save Availability"}
      </Button>

      <TimeOffSection spId={spId} />
    </div>
  );
}

function TimeOffSection({ spId }: { spId: string }) {
  const { data: blocks = [] } = useSpUnavailableBlocks(spId);
  const createBlock = useCreateSpUnavailable();
  const updateBlock = useUpdateSpUnavailable();
  const deleteBlock = useDeleteSpUnavailable();

  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<UnavailableDialogValue | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = blocks
    .filter((b) => b.date >= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  function openNew() {
    setInitial({ date: today, start: "09:00", end: "12:00", reason: "" });
    setOpen(true);
  }

  function openEdit(b: SpUnavailableBlock) {
    setInitial({ id: b.id, date: b.date, start: b.start, end: b.end, reason: b.reason });
    setOpen(true);
  }

  async function onSave(v: UnavailableDialogValue) {
    if (v.id) {
      await updateBlock.mutateAsync({ id: v.id, spId, date: v.date, start: v.start, end: v.end, reason: v.reason });
    } else {
      await createBlock.mutateAsync({ spId, date: v.date, start: v.start, end: v.end, reason: v.reason });
    }
    setOpen(false);
    setInitial(null);
  }

  async function onDelete(id: string) {
    await deleteBlock.mutateAsync({ id, spId });
    setOpen(false);
    setInitial(null);
  }

  return (
    <div className="metric-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Time Off</h2>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add time off
        </Button>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming time off scheduled.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => openEdit(b)}
                className="flex-1 text-left text-sm hover:text-primary"
              >
                <div className="font-medium">{b.date}</div>
                <div className="text-xs text-muted-foreground">
                  {b.start} – {b.end}
                  {b.reason && <span> · {b.reason}</span>}
                </div>
              </button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteBlock.mutate({ id: b.id, spId })}
                disabled={deleteBlock.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <UnavailableDialog
        open={open}
        initial={initial}
        onClose={() => { setOpen(false); setInitial(null); }}
        onSave={onSave}
        onDelete={onDelete}
        saving={createBlock.isPending || updateBlock.isPending}
        deleting={deleteBlock.isPending}
      />
    </div>
  );
}
