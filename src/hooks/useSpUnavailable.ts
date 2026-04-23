import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SpUnavailableBlock {
  id: string;
  spId: string;
  date: string;       // YYYY-MM-DD
  start: string;      // HH:MM
  end: string;        // HH:MM
  reason: string;
  spName?: string;
  spColor?: string | null;
}

interface DateRange {
  startISO: string;   // inclusive
  endISO: string;     // inclusive
}

function rowToBlock(row: any): SpUnavailableBlock {
  return {
    id: row.id,
    spId: row.sp_id,
    date: row.block_date,
    start: row.start_time,
    end: row.end_time,
    reason: row.reason ?? "",
  };
}

/** SP-scoped query (used by SP calendar + availability page). */
export function useSpUnavailableBlocks(spId: string | null) {
  return useQuery({
    queryKey: ["sp_unavailable", spId],
    enabled: !!spId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sp_unavailable_blocks")
        .select("*")
        .eq("sp_id", spId!)
        .order("block_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(rowToBlock);
    },
  });
}

/** Admin: all SPs in a date range, joined with SP name+color. */
export function useAllSpUnavailableBlocks(range?: DateRange | null) {
  return useQuery({
    queryKey: ["sp_unavailable_all", range?.startISO, range?.endISO],
    queryFn: async () => {
      let q = supabase
        .from("sp_unavailable_blocks")
        .select("*, service_providers!inner(id,name,calendar_color)")
        .order("block_date", { ascending: true });
      if (range) {
        q = q.gte("block_date", range.startISO).lte("block_date", range.endISO);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...rowToBlock(row),
        spName: row.service_providers?.name ?? "",
        spColor: row.service_providers?.calendar_color ?? null,
      })) as SpUnavailableBlock[];
    },
  });
}

export function useCreateSpUnavailable() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: {
      spId: string;
      date: string;
      start: string;
      end: string;
      reason: string;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error, data } = await supabase
        .from("sp_unavailable_blocks")
        .insert({
          sp_id: vars.spId,
          block_date: vars.date,
          start_time: vars.start,
          end_time: vars.end,
          reason: vars.reason,
          created_by_user_id: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return rowToBlock(data);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sp_unavailable", vars.spId] });
      qc.invalidateQueries({ queryKey: ["sp_unavailable_all"] });
      toast({ title: "Time off saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateSpUnavailable() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      spId: string;
      date: string;
      start: string;
      end: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("sp_unavailable_blocks")
        .update({
          block_date: vars.date,
          start_time: vars.start,
          end_time: vars.end,
          reason: vars.reason,
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sp_unavailable", vars.spId] });
      qc.invalidateQueries({ queryKey: ["sp_unavailable_all"] });
      toast({ title: "Time off updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteSpUnavailable() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: { id: string; spId: string }) => {
      const { error } = await supabase.from("sp_unavailable_blocks").delete().eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sp_unavailable", vars.spId] });
      qc.invalidateQueries({ queryKey: ["sp_unavailable_all"] });
      toast({ title: "Time off removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}
