import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ServiceProvider, Job } from "@/data/mockData";
import { computeProximityResult } from "@/lib/proximity";
import { haversineDistance } from "@/lib/proximity";

// ===== Types =====

export interface Offer {
  id: string;
  job_id: string;
  sp_id: string;
  allocation_run_id: string | null;
  status: "Pending" | "Accepted" | "Declined" | "Expired" | "Cancelled";
  offered_at: string;
  expires_at: string;
  responded_at: string | null;
  decline_reason: string | null;
  acceptance_source: string;
  created_by: string;
}

// ===== Queries =====

export function useOffers(jobId?: string) {
  return useQuery({
    queryKey: ["offers", jobId],
    queryFn: async () => {
      let query = supabase
        .from("offers")
        .select("*")
        .order("offered_at", { ascending: false });
      if (jobId) query = query.eq("job_id", jobId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
  });
}

export function useSpOffers(spId: string | null | undefined) {
  return useQuery({
    queryKey: ["offers", "sp", spId],
    queryFn: async () => {
      if (!spId) return [];
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("sp_id", spId)
        .eq("status", "Pending")
        .order("offered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
    enabled: !!spId,
  });
}

/** All offers for an SP (all statuses) — used for diagnostics */
export function useAllSpOffers(spId: string | null | undefined) {
  return useQuery({
    queryKey: ["offers", "sp-all", spId],
    queryFn: async () => {
      if (!spId) return [];
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("sp_id", spId)
        .order("offered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
    enabled: !!spId,
  });
}

/** Create a manual offer from admin */
export function useCreateManualOffer() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      jobId,
      spId,
      expiryMinutes = 10,
      createdBy = "system",
    }: {
      jobId: string;
      spId: string;
      expiryMinutes?: number;
      createdBy?: string;
    }) => {
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
      const { error } = await supabase.from("offers").insert({
        job_id: jobId,
        sp_id: spId,
        status: "Pending",
        expires_at: expiresAt,
        acceptance_source: "Manual",
        created_by: createdBy,
      } as any);
      if (error) throw error;

      // Update job status to Offered if still Created
      await supabase.from("jobs")
        .update({ status: "Offered" })
        .eq("id", jobId)
        .in("status", ["Created", "Offered"]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Offer sent", description: "Manual offer created for this SP." });
    },
    onError: (err: any) => {
      toast({ title: "Error creating offer", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Auto-accept evaluation =====

function evaluateAutoAccept(
  sp: ServiceProvider,
  job: Job,
): boolean {
  if (!sp.autoAccept) return false;

  // Fairness constraint
  if (sp.fairnessStatus === "Above Target Share") return false;

  // Category check
  if (!sp.serviceCategories.some(c => c.toLowerCase() === job.serviceCategory.toLowerCase())) return false;

  // Distance check
  const proxResult = computeProximityResult(sp.baseAddress, job.jobAddress);
  if (proxResult.distanceKm !== null && proxResult.distanceKm > sp.travelRadius) return false;

  // Payout check (min $50 default — could be configurable)
  // For prototype, auto-accept has no min payout gate

  return true;
}

// ===== Generate Offers =====

export function useGenerateOffers() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      jobId,
      allocationRunId,
      topSpIds,
      serviceProviders,
      job,
      expiryMinutes = 10,
      createdBy = "system",
    }: {
      jobId: string;
      allocationRunId: string;
      topSpIds: string[];
      serviceProviders: ServiceProvider[];
      job: Job;
      expiryMinutes?: number;
      createdBy?: string;
    }) => {
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
      const autoAcceptedSpId: string | null = null;

      const offerRows = topSpIds.map(spId => ({
        job_id: jobId,
        sp_id: spId,
        allocation_run_id: allocationRunId,
        status: "Pending",
        expires_at: expiresAt,
        acceptance_source: "Manual",
        created_by: createdBy,
      }));

      // Insert all offers
      const { data: insertedOffers, error: offerErr } = await supabase
        .from("offers")
        .insert(offerRows as any)
        .select("*");
      if (offerErr) throw offerErr;

      // Update job status to Offered
      await supabase.from("jobs").update({ status: "Offered" }).eq("id", jobId);

      // Check auto-accept for each SP
      for (const offer of (insertedOffers ?? []) as Offer[]) {
        const sp = serviceProviders.find(s => s.id === offer.sp_id);
        if (!sp) continue;

        if (evaluateAutoAccept(sp, job)) {
          // Auto-accept this offer
          // First verify job not already assigned
          const { data: jobRow } = await supabase
            .from("jobs")
            .select("assigned_sp_id")
            .eq("id", jobId)
            .single();
          if (jobRow?.assigned_sp_id) break; // Already taken

          // Accept the offer
          await supabase.from("offers")
            .update({
              status: "Accepted",
              responded_at: new Date().toISOString(),
              acceptance_source: "AutoAccept",
            } as any)
            .eq("id", offer.id);

          // Cancel remaining pending offers
          await supabase.from("offers")
            .update({ status: "Cancelled" } as any)
            .eq("job_id", jobId)
            .eq("status", "Pending")
            .neq("id", offer.id);

          // Assign job
          await supabase.from("jobs").update({
            assigned_sp_id: offer.sp_id,
            status: "Assigned",
          }).eq("id", jobId);

          // Audit
          await supabase.from("job_assignments").insert({
            job_id: jobId,
            sp_id: offer.sp_id,
            assignment_type: "AutoAccept",
          } as any);

          // Finalize allocation run
          await supabase.from("allocation_runs").update({
            selected_sp_id: offer.sp_id,
            finalized_at: new Date().toISOString(),
          } as any).eq("id", allocationRunId);

          return { autoAccepted: true, autoAcceptedSpId: offer.sp_id, offersCreated: insertedOffers?.length ?? 0 };
        }
      }

      return { autoAccepted: false, autoAcceptedSpId: null, offersCreated: insertedOffers?.length ?? 0 };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["allocation_runs"] });
      if (result.autoAccepted) {
        toast({ title: "Auto-accepted!", description: "An SP with auto-accept enabled took the job." });
      } else {
        toast({ title: "Offers sent", description: `${result.offersCreated} offers created.` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error generating offers", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Accept Offer =====

export function useAcceptOffer() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ offerId }: { offerId: string; jobId?: string; spId?: string }) => {
      const { data, error } = await supabase.rpc("accept_offer", { _offer_id: offerId });
      if (error) throw new Error(error.message);
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["allocation_runs"] });
      toast({ title: "Job accepted", description: "Job accepted and added to My Jobs." });
    },
    onError: (err: any) => {
      toast({ title: "Could not accept job", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Decline Offer =====

export function useDeclineOffer() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ offerId, declineReason }: { offerId: string; declineReason: string }) => {
      const { data, error } = await supabase.rpc("decline_offer", {
        _offer_id: offerId,
        _reason: declineReason,
      });
      if (error) throw new Error(error.message);
      const result = data as any;
      if (result?.error) throw new Error(result.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      toast({ title: "Offer declined" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Cancel Offers =====

export function useCancelOffers() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (jobId: string) => {
      await supabase.from("offers")
        .update({ status: "Cancelled" } as any)
        .eq("job_id", jobId)
        .eq("status", "Pending");

      // Reset job back to Created if still Offered
      await supabase.from("jobs")
        .update({ status: "Created" })
        .eq("id", jobId)
        .eq("status", "Offered");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Offers cancelled" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Expire stale offers (client-side check) =====

export function useExpireStaleOffers() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("offers")
        .update({ status: "Expired" } as any)
        .eq("status", "Pending")
        .lt("expires_at", now)
        .select("job_id");

      const jobIds = [...new Set((data ?? []).map((d: any) => d.job_id))];
      for (const jobId of jobIds) {
        const { count } = await supabase
          .from("offers")
          .select("*", { count: "exact", head: true })
          .eq("job_id", jobId)
          .eq("status", "Pending");
        if ((count ?? 0) === 0) {
          // All offers expired/declined — keep job as "Offered" but admin can re-run
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offers"] });
    },
  });
}

// ===== Generate Broadcast Offers =====

export function useGenerateBroadcastOffers() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      job,
      serviceProviders,
      expiryMinutes = 30,
      createdBy = "system",
    }: {
      job: Job;
      serviceProviders: ServiceProvider[];
      expiryMinutes?: number;
      createdBy?: string;
    }) => {
      const broadcastRadius = job.broadcastRadiusKm ?? 100;
      
      // Cancel any existing pending broadcast offers for this job first
      await supabase.from("offers")
        .update({ status: "Cancelled" } as any)
        .eq("job_id", job.dbId)
        .eq("status", "Pending")
        .eq("acceptance_source", "Broadcast");

      // Filter eligible SPs by hard gates only
      const eligibleSps = serviceProviders.filter(sp => {
        if (sp.status !== "Active") return false;
        if (sp.complianceStatus !== "Valid") return false;
        if (!sp.serviceCategories.some(c => c.toLowerCase() === job.serviceCategory.toLowerCase())) return false;
        
        // Distance check: within broadcast radius
        if (sp.baseAddress.lat && sp.baseAddress.lng && job.jobAddress.lat && job.jobAddress.lng) {
          const dist = haversineDistance(sp.baseAddress.lat, sp.baseAddress.lng, job.jobAddress.lat, job.jobAddress.lng);
          if (dist > broadcastRadius) return false;
        }
        
        return true;
      });

      if (eligibleSps.length === 0) {
        throw new Error("No eligible SPs found within broadcast radius. Check that SPs are Active, Compliant, have matching categories, and are within " + broadcastRadius + "km.");
      }

      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
      const offerRows = eligibleSps.map(sp => ({
        job_id: job.dbId,
        sp_id: sp.id,
        status: "Pending",
        expires_at: expiresAt,
        acceptance_source: "Broadcast",
        created_by: createdBy,
      }));

      const { data: inserted, error } = await supabase
        .from("offers")
        .insert(offerRows as any)
        .select("*");
      if (error) throw error;

      // Update job status
      await supabase.from("jobs").update({ status: "Offered" }).eq("id", job.dbId);

      return { offersCreated: inserted?.length ?? 0, eligibleCount: eligibleSps.length };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Broadcast offers sent", description: `${result.offersCreated} offers created for ${result.eligibleCount} eligible SPs.` });
    },
    onError: (err: any) => {
      toast({ title: "Broadcast failed", description: err.message, variant: "destructive" });
    },
  });
}
