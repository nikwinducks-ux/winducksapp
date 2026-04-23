import { haversineDistance, proximityScore, computeProximityResult } from "./proximity";
import type { ServiceProvider, Job } from "@/data/mockData";

// ===== Constants =====

/** Hard system cap: no SP beyond this distance is ever eligible */
export const MAX_SYSTEM_DISTANCE_KM = 100;

// ===== Types =====

export interface AllocationWeights {
  availability: number;
  proximity: number;
  competency: number;
  jobHistory: number;
  customerRating: number;
  reliability: number;
  responsiveness: number;
  safetyCompliance: number;
  fairness: number;
}

export interface FairnessConfig {
  rollingWindow: number;
  maxSharePercent: number;
  cooldownHours: number;
  minDistributionBoost: number;
  newSpBoostDays: number;
}

export interface PolicyRecord {
  id: string;
  version_name: string;
  weights_json: AllocationWeights;
  fairness_json: FairnessConfig;
  active: boolean;
  created_at: string;
}

export interface FairnessContext {
  /** Map of sp_id -> number of jobs assigned in rolling window */
  jobCountsInWindow: Record<string, number>;
  /** Total jobs assigned across all SPs in window */
  totalJobsInWindow: number;
  /** Number of eligible SPs */
  eligibleSpCount: number;
  /** Map of sp_id -> timestamp of most recent assignment */
  lastAssignedAt: Record<string, string>;
}

/** Pre-fetched unavailable block (one row from sp_unavailable_blocks). */
export interface UnavailableBlockLite {
  spId: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:MM
  end: string;    // HH:MM
}

export interface CandidateResult {
  sp: ServiceProvider;
  distKm: number | null;
  factorScores: {
    availability: number;
    proximity: number;
    competency: number;
    jobHistory: number;
    customerRating: number;
    reliability: number;
    responsiveness: number;
    safetyCompliance: number;
  };
  weightedScore: number;
  fairnessAdjustment: number;
  finalScore: number;
  rank: number;
  eligibilityStatus: "Eligible" | "Excluded";
  exclusionReason: string | null;
}

// ===== Helpers =====

function hhmmToMin(t: string | undefined | null): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function parseDurationMinutes(d?: string): number {
  if (!d) return 60;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?/gi;
  let total = 0;
  let matched = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    matched = true;
    const val = parseFloat(match[1]);
    const unit = (match[2] ?? "").toLowerCase();
    if (unit.startsWith("h")) total += val * 60;
    else total += val;
  }
  if (!matched || total <= 0) return 60;
  return Math.max(15, Math.round(total));
}

/** Build a lookup map keyed by sp_id for fast overlap checks. */
export function buildUnavailableMap(
  blocks: UnavailableBlockLite[]
): Map<string, UnavailableBlockLite[]> {
  const m = new Map<string, UnavailableBlockLite[]>();
  for (const b of blocks) {
    const arr = m.get(b.spId) ?? [];
    arr.push(b);
    m.set(b.spId, arr);
  }
  return m;
}

function jobOverlapsAnyBlock(
  job: Job,
  spId: string,
  unavailableMap: Map<string, UnavailableBlockLite[]> | undefined
): boolean {
  if (!unavailableMap) return false;
  if (!job.scheduledDate || !job.scheduledTime) return false;
  const startMin = hhmmToMin(job.scheduledTime);
  if (startMin == null) return false;
  const dur = parseDurationMinutes(job.estimatedDuration);
  const endMin = startMin + dur;
  const blocks = unavailableMap.get(spId);
  if (!blocks?.length) return false;
  return blocks.some((b) => {
    if (b.date !== job.scheduledDate) return false;
    const bs = hhmmToMin(b.start);
    const be = hhmmToMin(b.end);
    if (bs == null || be == null) return false;
    return bs < endMin && be > startMin;
  });
}

// ===== Deterministic factor scoring =====

function computeAvailability(sp: ServiceProvider): number {
  return sp.acceptanceRate;
}

function computeProximityFactor(sp: ServiceProvider, job: Job): { score: number; distKm: number | null } {
  const result = computeProximityResult(sp.baseAddress, job.jobAddress);
  return { score: result.score, distKm: result.distanceKm };
}

function computeCompetency(sp: ServiceProvider, job: Job): number {
  const categories = job.services && job.services.length > 0
    ? job.services.map(s => s.service_category)
    : [job.serviceCategory];
  const matchCount = categories.filter(cat =>
    sp.serviceCategories.some(c => c.toLowerCase() === cat.toLowerCase())
  ).length;
  const allMatch = matchCount === categories.length;
  const certBonus = Math.min(sp.certifications.length * 10, 20);
  return allMatch ? Math.min(80 + certBonus, 100) : Math.max(30 + certBonus, 0);
}

function computeJobHistory(sp: ServiceProvider): number {
  return Math.min(Math.round((sp.totalJobsCompleted / 500) * 100), 100);
}

function computeCustomerRating(sp: ServiceProvider): number {
  return Math.round(sp.rating * 20);
}

function computeReliability(sp: ServiceProvider): number {
  return sp.reliabilityScore;
}

function computeResponsiveness(sp: ServiceProvider): number {
  const match = sp.avgResponseTime.match(/(\d+)/);
  const minutes = match ? parseInt(match[1]) : 15;
  return Math.max(0, Math.min(100, Math.round(100 - (minutes / 15) * 100)));
}

function computeSafetyCompliance(sp: ServiceProvider): number {
  if (sp.complianceStatus === "Valid") return 100;
  if (sp.complianceStatus === "Expiring") return 60;
  return 0;
}

// ===== Fairness adjustment =====

function computeFairnessAdjustment(
  sp: ServiceProvider,
  fairnessConfig: FairnessConfig,
  fairnessCtx: FairnessContext
): number {
  const spJobs = fairnessCtx.jobCountsInWindow[sp.id] ?? 0;
  const totalJobs = fairnessCtx.totalJobsInWindow || 1;
  const eligibleCount = fairnessCtx.eligibleSpCount || 1;

  const targetShare = 1 / eligibleCount;
  const actualShare = spJobs / totalJobs;
  const maxShare = fairnessConfig.maxSharePercent / 100;

  let adjustment = 0;

  if (actualShare > targetShare) {
    const overRatio = (actualShare - targetShare) / targetShare;
    adjustment -= Math.round(overRatio * 15);
  }

  if (actualShare < targetShare && totalJobs > 0) {
    const underRatio = (targetShare - actualShare) / targetShare;
    adjustment += Math.round(underRatio * fairnessConfig.minDistributionBoost);
  }

  if (actualShare > maxShare) {
    adjustment -= 10;
  }

  if (sp.joinedDate) {
    const joinedMs = new Date(sp.joinedDate).getTime();
    const nowMs = Date.now();
    const daysSinceJoined = (nowMs - joinedMs) / (1000 * 60 * 60 * 24);
    if (daysSinceJoined <= fairnessConfig.newSpBoostDays) {
      adjustment += 5;
    }
  }

  return adjustment;
}

// ===== Eligibility checks =====

function checkEligibility(
  sp: ServiceProvider,
  job: Job,
  fairnessConfig: FairnessConfig,
  fairnessCtx: FairnessContext,
  distKm: number | null,
  unavailableMap?: Map<string, UnavailableBlockLite[]>
): { eligible: boolean; reason: string | null } {
  if (sp.status === "Suspended" || sp.status === "Archived") {
    return { eligible: false, reason: "Suspended/Archived" };
  }

  const categories = job.services && job.services.length > 0
    ? job.services.map(s => s.service_category)
    : [job.serviceCategory];
  const allMatch = categories.every(cat =>
    sp.serviceCategories.some(c => c.toLowerCase() === cat.toLowerCase())
  );
  if (!allMatch) {
    return { eligible: false, reason: "Category mismatch" };
  }

  if (distKm !== null && distKm > MAX_SYSTEM_DISTANCE_KM) {
    return { eligible: false, reason: `Distance > ${MAX_SYSTEM_DISTANCE_KM}km (${distKm}km)` };
  }

  const effectiveRadius = Math.min(sp.travelRadius, MAX_SYSTEM_DISTANCE_KM);
  if (distKm !== null && distKm > effectiveRadius) {
    return { eligible: false, reason: `Outside radius (${distKm}km > ${effectiveRadius}km)` };
  }

  // Time off block check (hard exclusion when job has scheduled date+time)
  if (jobOverlapsAnyBlock(job, sp.id, unavailableMap)) {
    return { eligible: false, reason: "Time off blocked" };
  }

  const lastAssigned = fairnessCtx.lastAssignedAt[sp.id];
  if (lastAssigned && fairnessConfig.cooldownHours > 0) {
    const hoursSince = (Date.now() - new Date(lastAssigned).getTime()) / (1000 * 60 * 60);
    if (hoursSince < fairnessConfig.cooldownHours) {
      return { eligible: false, reason: `Cooldown (${Math.round(hoursSince)}h < ${fairnessConfig.cooldownHours}h)` };
    }
  }

  const spJobs = fairnessCtx.jobCountsInWindow[sp.id] ?? 0;
  const totalJobs = fairnessCtx.totalJobsInWindow || 1;
  const actualShare = spJobs / totalJobs;
  const maxShare = fairnessConfig.maxSharePercent / 100;
  if (totalJobs >= 10 && actualShare > maxShare * 1.5) {
    return { eligible: false, reason: `Cap reached (${Math.round(actualShare * 100)}% > ${fairnessConfig.maxSharePercent}%)` };
  }

  return { eligible: true, reason: null };
}

// ===== Main allocation engine =====

export function runAllocation(
  job: Job,
  serviceProviders: ServiceProvider[],
  weights: AllocationWeights,
  fairnessConfig: FairnessConfig,
  fairnessCtx: FairnessContext,
  unavailableMap?: Map<string, UnavailableBlockLite[]>
): CandidateResult[] {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const candidates: CandidateResult[] = serviceProviders.map((sp) => {
    const { score: proxScore, distKm } = computeProximityFactor(sp, job);

    const factorScores = {
      availability: computeAvailability(sp),
      proximity: proxScore,
      competency: computeCompetency(sp, job),
      jobHistory: computeJobHistory(sp),
      customerRating: computeCustomerRating(sp),
      reliability: computeReliability(sp),
      responsiveness: computeResponsiveness(sp),
      safetyCompliance: computeSafetyCompliance(sp),
    };

    const { eligible, reason } = checkEligibility(sp, job, fairnessConfig, fairnessCtx, distKm, unavailableMap);

    const factorWeightMap: Record<string, number> = {
      availability: weights.availability,
      proximity: weights.proximity,
      competency: weights.competency,
      jobHistory: weights.jobHistory,
      customerRating: weights.customerRating,
      reliability: weights.reliability,
      responsiveness: weights.responsiveness,
      safetyCompliance: weights.safetyCompliance,
    };

    const factorWeightTotal = Object.values(factorWeightMap).reduce((a, b) => a + b, 0) || 1;

    let weightedScore = 0;
    for (const [key, weight] of Object.entries(factorWeightMap)) {
      weightedScore += (factorScores[key as keyof typeof factorScores] / 100) * (weight / factorWeightTotal) * 100;
    }
    weightedScore = Math.round(weightedScore * 100) / 100;

    const fairnessAdjustment = eligible
      ? computeFairnessAdjustment(sp, fairnessConfig, fairnessCtx)
      : 0;

    const fairnessWeightFraction = weights.fairness / totalWeight;
    const baseWeightFraction = 1 - fairnessWeightFraction;
    const finalScore = Math.round(
      (weightedScore * baseWeightFraction + (50 + fairnessAdjustment) * fairnessWeightFraction) * 100
    ) / 100;

    return {
      sp,
      distKm,
      factorScores,
      weightedScore,
      fairnessAdjustment,
      finalScore: eligible ? finalScore : 0,
      rank: 0,
      eligibilityStatus: eligible ? "Eligible" : "Excluded",
      exclusionReason: reason,
    };
  });

  candidates.sort((a, b) => {
    if (a.eligibilityStatus !== b.eligibilityStatus) {
      return a.eligibilityStatus === "Eligible" ? -1 : 1;
    }
    return b.finalScore - a.finalScore;
  });

  let rank = 1;
  candidates.forEach((c) => {
    if (c.eligibilityStatus === "Eligible") {
      c.rank = rank++;
    } else {
      c.rank = 0;
    }
  });

  return candidates;
}

// ===== Explainability =====

export function explainTopCandidate(
  candidate: CandidateResult,
  weights: AllocationWeights
): string {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const contributions = [
    { factor: "Availability", score: candidate.factorScores.availability, weight: weights.availability },
    { factor: "Proximity", score: candidate.factorScores.proximity, weight: weights.proximity },
    { factor: "Competency", score: candidate.factorScores.competency, weight: weights.competency },
    { factor: "Job History", score: candidate.factorScores.jobHistory, weight: weights.jobHistory },
    { factor: "Customer Rating", score: candidate.factorScores.customerRating, weight: weights.customerRating },
    { factor: "Reliability", score: candidate.factorScores.reliability, weight: weights.reliability },
    { factor: "Responsiveness", score: candidate.factorScores.responsiveness, weight: weights.responsiveness },
    { factor: "Safety/Compliance", score: candidate.factorScores.safetyCompliance, weight: weights.safetyCompliance },
  ];

  contributions.sort((a, b) => (b.score * b.weight) - (a.score * a.weight));

  const top5 = contributions.slice(0, 5);
  const parts = top5.map(
    (c) => `${c.factor}: ${c.score}% × ${Math.round((c.weight / totalWeight) * 100)}%w = ${Math.round((c.score * c.weight) / totalWeight)}`
  );

  let explanation = `${candidate.sp.name} scored ${candidate.finalScore} (weighted base: ${candidate.weightedScore}). `;
  explanation += `Top contributors: ${parts.join("; ")}. `;

  if (candidate.fairnessAdjustment !== 0) {
    explanation += `Fairness adjustment: ${candidate.fairnessAdjustment >= 0 ? "+" : ""}${candidate.fairnessAdjustment}. `;
  }

  if (candidate.distKm !== null) {
    explanation += `Distance: ${candidate.distKm}km.`;
  }

  return explanation;
}
