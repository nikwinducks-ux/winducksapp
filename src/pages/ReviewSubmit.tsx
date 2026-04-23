import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, AlertCircle } from "lucide-react";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; spName: string; jobNumber: string }
  | { kind: "submitted" }
  | { kind: "error"; message: string };

function StarInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
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
    </div>
  );
}

export default function ReviewSubmit() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [onTime, setOnTime] = useState(0);
  const [quality, setQuality] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      const result = data as { error?: string; status?: string; sp_name?: string; job_number?: string };
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
        spName: result?.sp_name ?? "your service provider",
        jobNumber: result?.job_number ?? "",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async () => {
    if (!token) return;
    if (onTime < 1 || quality < 1 || communication < 1) return;
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
      setState({ kind: "error", message: error.message });
      return;
    }
    const result = data as { error?: string; success?: boolean };
    if (result?.error) {
      setState({ kind: "error", message: result.error });
      return;
    }
    setState({ kind: "submitted" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border rounded-2xl shadow-sm p-8">
        {state.kind === "loading" && (
          <p className="text-center text-muted-foreground">Loading…</p>
        )}

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
              <h1 className="text-2xl font-bold">Rate your experience</h1>
              <p className="text-sm text-muted-foreground mt-1">
                How did <strong>{state.spName}</strong> do
                {state.jobNumber ? ` on ${state.jobNumber}` : ""}?
              </p>
            </div>

            <StarInput label="On-time arrival" value={onTime} onChange={setOnTime} />
            <StarInput label="Quality of work" value={quality} onChange={setQuality} />
            <StarInput label="Communication" value={communication} onChange={setCommunication} />

            <div className="space-y-2">
              <p className="text-sm font-medium">Comments (optional)</p>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anything you'd like us to know?"
                rows={4}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || onTime < 1 || quality < 1 || communication < 1}
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
