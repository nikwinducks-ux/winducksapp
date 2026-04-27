import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

export interface ScheduledVisitValue {
  id?: string;
  visitDate: string;     // YYYY-MM-DD
  startTime: string;     // HH:MM (24h)
  durationMin: number;
  note: string;
}

interface Props {
  open: boolean;
  initial?: ScheduledVisitValue | null;
  jobLabel: string;
  saving?: boolean;
  deleting?: boolean;
  onClose: () => void;
  onSave: (v: ScheduledVisitValue) => void;
  onDelete?: (id: string) => void;
}

const DURATIONS = [30, 45, 60, 90, 120, 180, 240];

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ScheduledVisitDialog({
  open, initial, jobLabel, saving, deleting, onClose, onSave, onDelete,
}: Props) {
  const [visitDate, setVisitDate] = useState(initial?.visitDate ?? todayISO());
  const [startTime, setStartTime] = useState(initial?.startTime ?? "09:00");
  const [durationMin, setDurationMin] = useState<number>(initial?.durationMin ?? 60);
  const [note, setNote] = useState(initial?.note ?? "");

  useEffect(() => {
    if (open) {
      setVisitDate(initial?.visitDate ?? todayISO());
      setStartTime(initial?.startTime ?? "09:00");
      setDurationMin(initial?.durationMin ?? 60);
      setNote(initial?.note ?? "");
    }
  }, [open, initial]);

  function handleSave() {
    onSave({ id: initial?.id, visitDate, startTime, durationMin, note });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit follow-up visit" : "Schedule follow-up visit"}</DialogTitle>
          <DialogDescription>For {jobLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="visit-date">Date</Label>
              <Input
                id="visit-date"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visit-start">Start time</Label>
              <Input
                id="visit-start"
                type="time"
                step={900}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select
              value={String(durationMin)}
              onValueChange={(v) => setDurationMin(Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d < 60 ? `${d} min` : d % 60 === 0 ? `${d / 60} hr` : `${Math.floor(d / 60)}h ${d % 60}m`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visit-note">Note (optional)</Label>
            <Textarea
              id="visit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Return to finish backyard"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div>
            {initial?.id && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDelete(initial.id!)}
                disabled={deleting}
              >
                {deleting ? "Removing..." : "Remove"}
              </Button>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={saving || !visitDate || !startTime}>
              {saving ? "Saving..." : initial?.id ? "Save" : "Schedule visit"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
