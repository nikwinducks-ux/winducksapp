import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { format } from "date-fns";

export default function SPReviewsTab({ spId }: { spId: string }) {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["sp-reviews", spId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_reviews")
        .select("id, status, on_time_score, quality_score, communication_score, overall_rating, comment, submitted_at, created_at, job_id")
        .eq("sp_id", spId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submitted = reviews.filter((r) => r.status === "submitted");
  const pending = reviews.filter((r) => r.status === "pending");
  const avg = submitted.length
    ? (submitted.reduce((s, r) => s + Number(r.overall_rating ?? 0), 0) / submitted.length).toFixed(2)
    : "—";

  return (
    <div className="metric-card space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Customer Reviews</h2>
        <div className="text-sm text-muted-foreground">
          {submitted.length} submitted · {pending.length} pending · avg ⭐ {avg}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>}

      {!isLoading && reviews.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No reviews yet.</p>
      )}

      <div className="space-y-3">
        {submitted.map((r) => (
          <div key={r.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-4 w-4 ${n <= Math.round(Number(r.overall_rating ?? 0)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                  />
                ))}
                <span className="ml-2 text-sm font-medium">{Number(r.overall_rating).toFixed(1)}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {r.submitted_at ? format(new Date(r.submitted_at), "PP") : ""}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>On-time: <span className="text-foreground font-medium">{r.on_time_score}/5</span></div>
              <div>Quality: <span className="text-foreground font-medium">{r.quality_score}/5</span></div>
              <div>Comms: <span className="text-foreground font-medium">{r.communication_score}/5</span></div>
            </div>
            {r.comment && <p className="text-sm text-foreground italic">"{r.comment}"</p>}
          </div>
        ))}

        {pending.length > 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            {pending.length} review{pending.length > 1 ? "s" : ""} pending customer response
          </div>
        )}
      </div>
    </div>
  );
}
