import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useRecordJobDeposit() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { job_id: string; amount: number; method?: string }) => {
      const { data, error } = await supabase.rpc("record_job_deposit", {
        _job_id: args.job_id,
        _amount: args.amount,
        _method: args.method ?? "",
      });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Deposit recorded" });
    },
    onError: (e: any) =>
      toast({ title: "Failed to record deposit", description: e.message, variant: "destructive" }),
  });
}
