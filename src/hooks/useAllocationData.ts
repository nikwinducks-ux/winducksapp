import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AllocationWeights, FairnessConfig, PolicyRecord, CandidateResult, FairnessContext } from "@/lib/allocation-engine";

// ===== Policies =====

export function useAllocationPolicies() {
  return useQuery({
    queryKey: ["allocation_policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allocation_policies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        version_name: r.version_name,
        weights_json: r.weights_json as AllocationWeights,
        fairness_json: r.fairness_json as FairnessConfig,
        active: r.active,
        created_at: r.created_at,
      })) as PolicyRecord[];
    },
  });
}

export function useActivePolicy() {
  const { data: policies = [] } = useAllocationPolicies();
  return policies.find((p) => p.active) ?? policies[0] ?? null;
}

export function useSavePolicy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      versionName, weights, fairness,
    }: {
      versionName: string; weights: AllocationWeights; fairness: FairnessConfig;
    }) => {
      // Deactivate all existing
      await supabase.from("allocation_policies").update({ active: false } as any).eq("active", true);
      // Insert new active
      const { error } = await supabase.from("allocation_policies").insert({
        version_name: versionName,
        weights_json: weights as any,
        fairness_json: fairness as any,
        active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allocation_policies"] });
      toast({ title: "Policy saved", description: "New policy version is now active." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useActivatePolicy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (policyId: string) => {
      await supabase.from("allocation_policies").update({ active: false } as any).eq("active", true);
      const { error } = await supabase.from("allocation_policies").update({ active: true } as any).eq("id", policyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allocation_policies"] });
      toast({ title: "Policy activated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Fairness context from DB =====

export function useFairnessContext(rollingWindowDays: number) {
  return useQuery({
    queryKey: ["fairness_context", rollingWindowDays],
    queryFn: async (): Promise<FairnessContext> => {
      const windowStart = new Date(Date.now() - rollingWindowDays * 24 * 60 * 60 * 1000).toISOString();

      // Get job counts per SP in window
      const { data: assignments, error } = await supabase
        .from("job_assignments")
        .select("sp_id, assigned_at")
        .gte("assigned_at", windowStart);
      if (error) throw error;

      const jobCounts: Record<string, number> = {};
      const lastAssigned: Record<string, string> = {};
      let total = 0;

      (assignments ?? []).forEach((a: any) => {
        jobCounts[a.sp_id] = (jobCounts[a.sp_id] || 0) + 1;
        total++;
        if (!lastAssigned[a.sp_id] || a.assigned_at > lastAssigned[a.sp_id]) {
          lastAssigned[a.sp_id] = a.assigned_at;
        }
      });

      // Count eligible SPs
      const { count: spCount } = await supabase
        .from("service_providers")
        .select("*", { count: "exact", head: true })
        .neq("status", "Suspended")
        .neq("status", "Archived");

      return {
        jobCountsInWindow: jobCounts,
        totalJobsInWindow: total,
        eligibleSpCount: spCount ?? 1,
        lastAssignedAt: lastAssigned,
      };
    },
  });
}

// ===== Allocation run logging =====

export function useSaveAllocationRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId, policyId, selectedSpId, candidates, userId, label,
    }: {
      jobId: string;
      policyId: string;
      selectedSpId: string | null;
      candidates: CandidateResult[];
      userId?: string;
      label?: string;
    }) => {
      // Insert run
      const { data: run, error: runErr } = await supabase
        .from("allocation_runs")
        .insert({
          job_id: jobId,
          policy_id: policyId,
          selected_sp_id: selectedSpId,
          created_by_user_id: userId ?? null,
          label: label ?? "",
        } as any)
        .select("id")
        .single();
      if (runErr) throw runErr;

      // Insert candidates
      const rows = candidates.map((c) => ({
        allocation_run_id: run.id,
        sp_id: c.sp.id,
        factor_scores_json: c.factorScores as any,
        weighted_score: c.weightedScore,
        fairness_adjustment: c.fairnessAdjustment,
        final_score: c.finalScore,
        rank: c.rank,
        eligibility_status: c.eligibilityStatus,
        exclusion_reason: c.exclusionReason ?? null,
      }));

      const { error: candErr } = await supabase
        .from("allocation_run_candidates")
        .insert(rows as any);
      if (candErr) throw candErr;

      return run.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allocation_runs"] });
    },
  });
}

export function useAllocationRuns(jobId?: string) {
  return useQuery({
    queryKey: ["allocation_runs", jobId],
    queryFn: async () => {
      let query = supabase
        .from("allocation_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (jobId) query = query.eq("job_id", jobId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
