import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Missing token." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_KEY } },
        );
        const data = await res.json();
        if (data.valid === true) setState({ kind: "ready" });
        else if (data.reason === "already_unsubscribed") setState({ kind: "already" });
        else setState({ kind: "error", message: data.error ?? "Invalid link" });
      } catch (e: any) {
        setState({ kind: "error", message: e.message ?? "Network error" });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setSubmitting(false);
    if (error) {
      setState({ kind: "error", message: error.message });
      return;
    }
    if ((data as any)?.success) setState({ kind: "done" });
    else if ((data as any)?.reason === "already_unsubscribed") setState({ kind: "already" });
    else setState({ kind: "error", message: (data as any)?.error ?? "Failed" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border rounded-2xl shadow-sm p-8 text-center space-y-4">
        {state.kind === "loading" && <p className="text-muted-foreground">Loading…</p>}
        {state.kind === "ready" && (
          <>
            <h1 className="text-xl font-bold">Unsubscribe from emails?</h1>
            <p className="text-sm text-muted-foreground">
              You'll stop receiving notification emails from WinDucks.
            </p>
            <Button onClick={confirm} disabled={submitting} className="w-full">
              {submitting ? "Processing…" : "Confirm unsubscribe"}
            </Button>
          </>
        )}
        {state.kind === "done" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h1 className="text-xl font-bold">You're unsubscribed</h1>
            <p className="text-sm text-muted-foreground">We won't email this address anymore.</p>
          </>
        )}
        {state.kind === "already" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold">Already unsubscribed</h1>
            <p className="text-sm text-muted-foreground">This email is already opted out.</p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </>
        )}
      </div>
    </div>
  );
}
