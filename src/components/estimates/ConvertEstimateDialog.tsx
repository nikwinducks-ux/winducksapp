import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobs } from "@/hooks/useSupabaseData";
import { useConvertEstimateToJob, useEstimate, useEstimateLineItems } from "@/hooks/useEstimates";
import { formatCAD } from "@/lib/currency";

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
  const { data: estimate } = useEstimate(estimateId);
  const acceptedPkgId = estimate?.accepted_package_id ?? null;
  const { data: items = [] } = useEstimateLineItems(acceptedPkgId ? [acceptedPkgId] : []);

  const candidateJobs = jobs.filter((j) => j.customerId === customerId);
  const selectedItems = items.filter((i) => i.is_selected);
  const services = selectedItems.filter((i) => i.item_type !== "product");
  const products = selectedItems.filter((i) => i.item_type === "product");

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
          {/* Carryover summary */}
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total invoice (carried over)</span>
              <span className="font-semibold">{formatCAD(estimate?.accepted_total ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit due (record only)</span>
              <span className="font-semibold">{formatCAD(estimate?.accepted_deposit ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selected line items</span>
              <span className="font-semibold">
                {services.length} service{services.length === 1 ? "" : "s"}
                {products.length > 0 && ` · ${products.length} product${products.length === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>

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
                Attaching will replace this job's existing services and update its total invoice and deposit due to match the accepted estimate.
              </p>
            </div>
          )}
          {mode === "new" && (
            <p className="text-xs text-muted-foreground">
              A new job will be created using the customer's address and the accepted package's selected line items. Total invoice and deposit due are carried over.
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
