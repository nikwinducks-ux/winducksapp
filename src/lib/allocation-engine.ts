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

// ===== Deterministic factor scoring =====

function computeAvailability(sp: ServiceProvider): number {
  // Based on acceptance rate (0-100 already)
  return sp.acceptanceRate;
}

function computeProximityFactor(sp: ServiceProvider, job: Job): { score: number; distKm: number | null } {
  const result = computeProximityResult(sp.baseAddress, job.jobAddress);
  return { score: result.score, distKm: result.distanceKm };
}

function computeCompetency(sp: ServiceProvider, job: Job): number {
  // Multi-service: SP must match ALL service categories
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
  // Normalize total jobs completed: 0 jobs = 0, 500+ = 100
  return Math.min(Math.round((sp.totalJobsCompleted / 500) * 100), 100);
}

function computeCustomerRating(sp: ServiceProvider): number {
  return Math.round(sp.rating * 20); // 5.0 -> 100
}

function computeReliability(sp: ServiceProvider): number {
  return sp.reliabilityScore;
}

function computeResponsiveness(sp: ServiceProvider): number {
  // Parse avg response time like "4 min" -> lower = better
  const match = sp.avgResponseTime.match(/(\d+)/);
  const minutes = match ? parseInt(match[1]) : 15;
  // 0 min = 100, 15+ min = 0
  return Math.max(0, Math.min(100, Math.round(100 - (minutes / 15) * 100)));
}

function computeSafetyCompliance(sp: ServiceProvider): number {
  if (sp.complianceStatus === "Valid") return 100;
  if (sp.complianceStatus === "Expiring") return 60;
  return 0; // Suspended
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

  // Target share per SP
  const targetShare = 1 / eligibleCount;
  const actualShare = spJobs / totalJobs;
  const maxShare = fairnessConfig.maxSharePercent / 100;

  let adjustment = 0;

  // Penalize if above target
  if (actualShare > targetShare) {
    const overRatio = (actualShare - targetShare) / targetShare;
    adjustment -= Math.round(overRatio * 15); // up to -15
  }

  // Boost if below target
  if (actualShare < targetShare && totalJobs > 0) {
    const underRatio = (targetShare - actualShare) / targetShare;
    adjustment += Math.round(underRatio * fairnessConfig.minDistributionBoost);
  }

  // Extra penalty if above max share cap
  if (actualShare > maxShare) {
    adjustment -= 10;
  }

  // New SP boost
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
  distKm: number | null
): { eligible: boolean; reason: string | null } {
  // Suspended
  if (sp.status === "Suspended" || sp.status === "Archived") {
    return { eligible: false, reason: "Suspended/Archived" };
  }

  // Category mismatch — must match ALL service categories
  const categories = job.services && job.services.length > 0
    ? job.services.map(s => s.service_category)
    : [job.serviceCategory];
  const allMatch = categories.every(cat =>
    sp.serviceCategories.some(c => c.toLowerCase() === cat.toLowerCase())
  );
  if (!allMatch) {
    return { eligible: false, reason: "Category mismatch" };
  }

  // Hard system distance cap — always enforced
  if (distKm !== null && distKm > MAX_SYSTEM_DISTANCE_KM) {
    return { eligible: false, reason: `Distance > ${MAX_SYSTEM_DISTANCE_KM}km (${distKm}km)` };
  }

  // SP travel radius — must be within MIN(sp.travelRadius, MAX_SYSTEM_DISTANCE_KM)
  const effectiveRadius = Math.min(sp.travelRadius, MAX_SYSTEM_DISTANCE_KM);
  if (distKm !== null && distKm > effectiveRadius) {
    return { eligible: false, reason: `Outside radius (${distKm}km > ${effectiveRadius}km)` };
  }

  // Cooldown
  const lastAssigned = fairnessCtx.lastAssignedAt[sp.id];
  if (lastAssigned && fairnessConfig.cooldownHours > 0) {
    const hoursSince = (Date.now() - new Date(lastAssigned).getTime()) / (1000 * 60 * 60);
    if (hoursSince < fairnessConfig.cooldownHours) {
      return { eligible: false, reason: `Cooldown (${Math.round(hoursSince)}h < ${fairnessConfig.cooldownHours}h)` };
    }
  }

  // Max share cap exclusion
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
  fairnessCtx: FairnessContext
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

    const { eligible, reason } = checkEligibility(sp, job, fairnessConfig, fairnessCtx, distKm);

    // Weighted score (excluding fairness weight which applies to adjustment)
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

    // Final score applies fairness weight
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

  // Sort: eligible first by finalScore desc, then excluded
  candidates.sort((a, b) => {
    if (a.eligibilityStatus !== b.eligibilityStatus) {
      return a.eligibilityStatus === "Eligible" ? -1 : 1;
    }
    return b.finalScore - a.finalScore;
  });

  // Assign ranks (only eligible get real ranks)
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

  // Sort by weighted contribution
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
