// Deterministic SP color assignment for calendar blocks.
// Hash an SP id to one of the palette entries so the same SP always
// gets the same tint across views and sessions.

export type SpColor = {
  /** Solid background variant (Assigned/Accepted/InProgress). */
  solid: string;
  /** Soft tinted background variant (used for pending/dashed). */
  soft: string;
  /** Small swatch class for the legend. */
  swatch: string;
};

const PALETTE: SpColor[] = [
  { solid: "bg-blue-500 text-white border-blue-600 hover:bg-blue-500/90",          soft: "bg-blue-100 text-blue-900 border-blue-400",          swatch: "bg-blue-500" },
  { solid: "bg-teal-500 text-white border-teal-600 hover:bg-teal-500/90",          soft: "bg-teal-100 text-teal-900 border-teal-400",          swatch: "bg-teal-500" },
  { solid: "bg-violet-500 text-white border-violet-600 hover:bg-violet-500/90",    soft: "bg-violet-100 text-violet-900 border-violet-400",    swatch: "bg-violet-500" },
  { solid: "bg-amber-500 text-white border-amber-600 hover:bg-amber-500/90",       soft: "bg-amber-100 text-amber-900 border-amber-400",       swatch: "bg-amber-500" },
  { solid: "bg-rose-500 text-white border-rose-600 hover:bg-rose-500/90",          soft: "bg-rose-100 text-rose-900 border-rose-400",          swatch: "bg-rose-500" },
  { solid: "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-500/90", soft: "bg-emerald-100 text-emerald-900 border-emerald-400", swatch: "bg-emerald-500" },
  { solid: "bg-indigo-500 text-white border-indigo-600 hover:bg-indigo-500/90",    soft: "bg-indigo-100 text-indigo-900 border-indigo-400",    swatch: "bg-indigo-500" },
  { solid: "bg-orange-500 text-white border-orange-600 hover:bg-orange-500/90",    soft: "bg-orange-100 text-orange-900 border-orange-400",    swatch: "bg-orange-500" },
  { solid: "bg-cyan-500 text-white border-cyan-600 hover:bg-cyan-500/90",          soft: "bg-cyan-100 text-cyan-900 border-cyan-400",          swatch: "bg-cyan-500" },
  { solid: "bg-fuchsia-500 text-white border-fuchsia-600 hover:bg-fuchsia-500/90", soft: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-400", swatch: "bg-fuchsia-500" },
];

const UNASSIGNED: SpColor = {
  solid: "bg-muted text-foreground border-border hover:bg-muted/80",
  soft: "bg-muted/60 text-muted-foreground border-border",
  swatch: "bg-muted-foreground/40",
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getSpColor(spId?: string | null): SpColor {
  if (!spId) return UNASSIGNED;
  return PALETTE[hashString(spId) % PALETTE.length];
}

export function getUnassignedSpColor(): SpColor {
  return UNASSIGNED;
}
