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
import { Input } from "@/components/ui/input";
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

  function handleSave() {
    setError(null);
    if (!/^\d{2}:\d{2}$/.test(end)) {
      setError("Please enter a valid end time.");
      return;
    }
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (endMin - startMin < 15) {
      setError("End time must be at least 15 minutes after start time.");
      return;
    }
    onSave({ id: initial?.id, date, start, end, reason: reason.trim() });
  }

  const isEdit = !!initial?.id;

  function formatTime12(t: string): string {
    if (!/^\d{2}:\d{2}$/.test(t)) return t;
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }

  function formatDateLabel(d: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const [y, mo, da] = d.split("-").map(Number);
    const dt = new Date(y, mo - 1, da);
    return dt.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  const summary =
    date && start && end
      ? `${formatDateLabel(date)} · ${formatTime12(start)} – ${formatTime12(end)}`
      : "";

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
          {summary && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground">
              {summary}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ua-end">End time</Label>
            <Input
              id="ua-end"
              type="time"
              step={900}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
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
