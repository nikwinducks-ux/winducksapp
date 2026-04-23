import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, AlertCircle, Briefcase, Calendar, MapPin, Hash } from "lucide-react";

const COMMENT_MAX = 1000;

type ReadyData = {
  spName: string;
  jobNumber: string;
  serviceSummary: string;
  scheduledDate: string | null;
  scheduledTime: string;
  city: string;
  region: string;
  customerName: string;
  completedAt: string | null;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; data: ReadyData }
  | { kind: "submitted" }
  | { kind: "error"; message: string };

function StarInput({
  label,
  helper,
  value,
  onChange,
  error,
}: {
  label: string;
  helper: string;
  value: number;
  onChange: (v: number) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`h-8 w-8 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
            />
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function formatDate(dateStr: string | null, timeStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T00:00:00");
    const formatted = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return timeStr ? `${formatted} at ${timeStr}` : formatted;
  } catch {
    return dateStr;
  }
}

export default function ReviewSubmit() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [onTime, setOnTime] = useState(0);
  const [quality, setQuality] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setState({ kind: "error", message: "Missing review token." });
        return;
      }
      const { data, error } = await supabase.rpc("get_review_by_token", { _token: token });
      if (cancelled) return;
      if (error) {
        setState({ kind: "error", message: error.message });
        return;
      }
      const result = data as {
        error?: string;
        status?: string;
        sp_name?: string;
        job_number?: string;
        service_summary?: string;
        scheduled_date?: string | null;
        scheduled_time?: string;
        job_address_city?: string;
        job_address_region?: string;
        customer_name?: string;
        completed_at?: string | null;
      };
      if (result?.error) {
        setState({ kind: "error", message: result.error });
        return;
      }
      if (result?.status === "submitted") {
        setState({ kind: "submitted" });
        return;
      }
      setState({
        kind: "ready",
        data: {
          spName: result?.sp_name ?? "your service provider",
          jobNumber: result?.job_number ?? "",
          serviceSummary: result?.service_summary ?? "",
          scheduledDate: result?.scheduled_date ?? null,
          scheduledTime: result?.scheduled_time ?? "",
          city: result?.job_address_city ?? "",
          region: result?.job_address_region ?? "",
          customerName: result?.customer_name ?? "",
          completedAt: result?.completed_at ?? null,
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const commentTooLong = comment.length > COMMENT_MAX;
  const allRated = onTime >= 1 && quality >= 1 && communication >= 1;

  const handleSubmit = async () => {
    if (!token) return;
    setAttempted(true);
    setSubmitError(null);
    if (!allRated || commentTooLong) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_review", {
      _token: token,
      _on_time: onTime,
      _quality: quality,
      _communication: communication,
      _comment: comment,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    const result = data as { error?: string; success?: boolean };
    if (result?.error) {
      setSubmitError(result.error);
      return;
    }
    setState({ kind: "submitted" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border rounded-2xl shadow-sm p-8">
        {state.kind === "loading" && <p className="text-center text-muted-foreground">Loading…</p>}

        {state.kind === "error" && (
          <div className="text-center space-y-3">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        )}

        {state.kind === "submitted" && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h1 className="text-xl font-bold">Thanks for your feedback!</h1>
            <p className="text-sm text-muted-foreground">
              Your review has been recorded. We appreciate you taking the time.
            </p>
          </div>
        )}

        {state.kind === "ready" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Rate your experience with {state.data.spName}</h1>
              {state.data.customerName && (
                <p className="text-sm text-muted-foreground mt-2">Hi {state.data.customerName},</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Your feedback helps us keep our service providers accountable. Thank you for taking a moment to share.
              </p>
            </div>

            {/* Job summary card */}
            <div className="bg-muted/40 border rounded-lg p-4 space-y-2 text-sm">
              {state.data.jobNumber && (
                <div className="flex items-start gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="font-medium">{state.data.jobNumber}</span>
                </div>
              )}
              {state.data.serviceSummary && (
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{state.data.serviceSummary}</span>
                </div>
              )}
              {(state.data.scheduledDate || state.data.completedAt) && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>
                    {state.data.scheduledDate
                      ? formatDate(state.data.scheduledDate, state.data.scheduledTime)
                      : state.data.completedAt
                        ? `Completed ${new Date(state.data.completedAt).toLocaleDateString()}`
                        : ""}
                  </span>
                </div>
              )}
              {(state.data.city || state.data.region) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{[state.data.city, state.data.region].filter(Boolean).join(", ")}</span>
                </div>
              )}
            </div>

            <StarInput
              label="On-time arrival"
              helper="Did they arrive when expected?"
              value={onTime}
              onChange={(v) => {
                setOnTime(v);
                setSubmitError(null);
              }}
              error={attempted && onTime < 1 ? "Please rate this" : undefined}
            />
            <StarInput
              label="Quality of work"
              helper="Were you happy with the result?"
              value={quality}
              onChange={(v) => {
                setQuality(v);
                setSubmitError(null);
              }}
              error={attempted && quality < 1 ? "Please rate this" : undefined}
            />
            <StarInput
              label="Communication"
              helper="Were they clear and responsive?"
              value={communication}
              onChange={(v) => {
                setCommunication(v);
                setSubmitError(null);
              }}
              error={attempted && communication < 1 ? "Please rate this" : undefined}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Comments (optional)</p>
                <span
                  className={`text-xs ${commentTooLong ? "text-destructive font-medium" : "text-muted-foreground"}`}
                >
                  {comment.length}/{COMMENT_MAX}
                </span>
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anything you'd like us to know?"
                rows={4}
                aria-invalid={commentTooLong}
              />
              {commentTooLong && (
                <p className="text-xs text-destructive">Comment must be {COMMENT_MAX} characters or fewer.</p>
              )}
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || commentTooLong}
              className="w-full"
              size="lg"
            >
              {submitting ? "Submitting…" : "Submit review"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
