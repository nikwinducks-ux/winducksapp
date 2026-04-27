import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobs } from "@/hooks/useSupabaseData";
import { useConvertEstimateToJob } from "@/hooks/useEstimates";

export function ConvertEstimateDialog({
  open, onOpenChange, estimateId, customerId, onConverted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  estimateId: string;
  customerId: string | null;
  onConverted: (jobId: string) => void;
}) {
  const [mode, setMode] = useState<"new" | "attach">("new");
  const [jobId, setJobId] = useState<string>("");
  const { data: jobs = [] } = useJobs();
  const convert = useConvertEstimateToJob();

  const candidateJobs = jobs.filter((j) => j.customerId === customerId);

  const handleConvert = async () => {
    const r = await convert.mutateAsync({
      estimate_id: estimateId,
      mode,
      existing_job_id: mode === "attach" ? jobId : undefined,
    });
    onConverted(r.job_id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert estimate to job</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create a new job</SelectItem>
                <SelectItem value="attach" disabled={candidateJobs.length === 0}>
                  Attach to existing job {candidateJobs.length === 0 && "(none for this customer)"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "attach" && (
            <div className="space-y-2">
              <Label>Existing job</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger><SelectValue placeholder="Pick a job" /></SelectTrigger>
                <SelectContent>
                  {candidateJobs.map((j) => (
                    <SelectItem key={j.dbId} value={j.dbId}>{j.id} — {j.serviceCategory || "(no category)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-warning">
                Attaching will replace this job's existing services with the accepted package's items.
              </p>
            </div>
          )}
          {mode === "new" && (
            <p className="text-xs text-muted-foreground">
              A new job will be created using the customer's address and the accepted package's selected line items.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConvert} disabled={convert.isPending || (mode === "attach" && !jobId)}>
            {convert.isPending ? "Converting..." : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
