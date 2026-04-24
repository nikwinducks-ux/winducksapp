import { Phone, Star, Users } from "lucide-react";
import { useJobCrew, useServiceProviders } from "@/hooks/useSupabaseData";

interface CrewTeammatesProps {
  jobId: string | undefined;
  excludeSpId?: string | null;
  variant?: "card" | "inline";
  showPhone?: boolean;
  /** When true, render nothing (not even a heading) if no teammates. */
  hideWhenEmpty?: boolean;
}

function telHref(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

export function CrewTeammates({
  jobId,
  excludeSpId,
  variant = "card",
  showPhone = false,
  hideWhenEmpty = true,
}: CrewTeammatesProps) {
  const { data: crew = [], isLoading } = useJobCrew(jobId);
  const { data: providers = [] } = useServiceProviders();

  const teammates = crew
    .filter((c) => c.spId !== excludeSpId)
    .map((c) => ({
      crew: c,
      sp: providers.find((p) => p.id === c.spId),
    }));

  if (isLoading) return null;
  if (teammates.length === 0 && hideWhenEmpty) return null;

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap mt-1">
        <Users className="h-3 w-3 shrink-0" />
        <span>Working with:</span>
        {teammates.map((t, i) => (
          <span key={t.crew.id} className="font-medium text-foreground">
            {t.sp?.name ?? "Unknown SP"}{t.crew.isLead ? " ★" : ""}{i < teammates.length - 1 ? "," : ""}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Users className="h-4 w-4" /> Working with ({teammates.length})
      </h3>
      <div className="space-y-2">
        {teammates.map(({ crew: m, sp }) => {
          const initials = sp?.name
            ? sp.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
            : "?";
          const href = showPhone ? telHref(sp?.phone) : null;
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-md border bg-background p-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {sp?.name ?? "Unknown SP"}
                  {m.isLead && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium">
                      <Star className="h-3 w-3 fill-current" /> Lead
                    </span>
                  )}
                </p>
                {showPhone && (
                  href ? (
                    <a
                      href={href}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                    >
                      <Phone className="h-3 w-3" /> {sp?.phone}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">— no phone on file</p>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CrewTeammates;
