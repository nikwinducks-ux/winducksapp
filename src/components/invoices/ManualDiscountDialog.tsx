import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpsertInvoiceManualDiscount } from "@/hooks/useInvoices";

export function ManualDiscountDialog({
  open, onOpenChange, invoiceId,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; invoiceId: string;
}) {
  const upsert = useUpsertInvoiceManualDiscount();
  const [kind, setKind] = useState<"fixed" | "percent">("fixed");
  const [value, setValue] = useState(0);
  const [reason, setReason] = useState("");

  const submit = async () => {
    await upsert.mutateAsync({ invoice_id: invoiceId, scope: "invoice", kind, value, reason });
    onOpenChange(false);
    setValue(0); setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add manual discount</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed ($)</SelectItem>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Input type="number" step="0.01" value={value} onChange={(e) => setValue(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Loyalty credit, Warranty adjustment" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending || value <= 0}>Add discount</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
