import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Tiny base64-encoded chime (short sine beep) — no asset required
const CHIME_DATA_URL =
  "data:audio/wav;base64,UklGRlwGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTgGAAAAAAAA/3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//fw==";

function playChime() {
  try {
    const audio = new Audio(CHIME_DATA_URL);
    audio.volume = 0.4;
    void audio.play().catch(() => {});
  } catch (_e) {
    /* ignore */
  }
}

export function useOfferRealtime(spId: string | null | undefined) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const seenInsertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!spId) return;

    const channel = supabase
      .channel(`offers-sp-${spId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "offers", filter: `sp_id=eq.${spId}` },
        (payload) => {
          const row = payload.new as { id: string; status: string; job_id: string };
          if (!row || row.status !== "Pending") return;
          if (seenInsertIds.current.has(row.id)) return;
          seenInsertIds.current.add(row.id);

          playChime();
          toast.success("New job offer", {
            description: "Tap to review the offer details.",
            action: {
              label: "View",
              onClick: () => navigate(`/jobs/${row.job_id}?offer=${row.id}`),
            },
          });
          qc.invalidateQueries({ queryKey: ["offers"] });
          qc.invalidateQueries({ queryKey: ["jobs"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "offers", filter: `sp_id=eq.${spId}` },
        (payload) => {
          const oldRow = payload.old as { status?: string } | null;
          const newRow = payload.new as { id: string; status: string; job_id: string; acceptance_source?: string };
          if (!newRow) return;
          const becameAccepted =
            newRow.status === "Accepted" && oldRow?.status !== "Accepted";
          if (becameAccepted && newRow.acceptance_source === "AutoAccept") {
            playChime();
            toast.success("Auto-accepted job", {
              description: "We accepted this offer for you based on your settings.",
              action: {
                label: "View",
                onClick: () => navigate(`/jobs/${newRow.job_id}`),
              },
            });
            qc.invalidateQueries({ queryKey: ["offers"] });
            qc.invalidateQueries({ queryKey: ["jobs"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spId, qc, navigate]);
}
