import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface UnavailableDialogValue {
  id?: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:MM
  end: string;    // HH:MM
  reason: string;
}

interface Props {
  open: boolean;
  initial: UnavailableDialogValue | null;
  onClose: () => void;
  onSave: (v: UnavailableDialogValue) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  saving?: boolean;
  deleting?: boolean;
}

export default function UnavailableDialog({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting,
}: Props) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && initial) {
      setDate(initial.date);
      setStart(initial.start);
      setEnd(initial.end);
      setReason(initial.reason ?? "");
      setError(null);
    }
  }, [open, initial]);

  function toMin(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function handleSave() {
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      setError("Start and end times must be in HH:MM format.");
      return;
    }
    if (toMin(end) - toMin(start) < 15) {
      setError("Time off must be at least 15 minutes.");
      return;
    }
    setError(null);
    onSave({ id: initial?.id, date, start, end, reason: reason.trim() });
  }

  const isEdit = !!initial?.id;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit time off" : "Mark unavailable"}</DialogTitle>
          <DialogDescription>
            Block this time so the system won't offer you jobs that overlap it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ua-start">Start</Label>
              <Input
                id="ua-start"
                type="time"
                step={900}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ua-end">End</Label>
              <Input
                id="ua-end"
                type="time"
                step={900}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ua-reason">Reason (optional)</Label>
            <Textarea
              id="ua-reason"
              rows={3}
              placeholder="e.g. Doctor appointment, family event…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {isEdit && onDelete && initial?.id && (
              <Button
                variant="destructive"
                onClick={() => onDelete(initial.id!)}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
