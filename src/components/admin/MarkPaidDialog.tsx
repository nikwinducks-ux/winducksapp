import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMarkInvoicePaid, type SPInvoice } from "@/hooks/useSupabaseData";
import { formatCAD } from "@/lib/currency";

interface Props {
  invoice: SPInvoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkPaidDialog({ invoice, open, onOpenChange }: Props) {
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const markPaid = useMarkInvoicePaid();

  const handleSave = () => {
    if (!invoice) return;
    markPaid.mutate(
      { id: invoice.id, paymentMethod: method, paymentReference: reference, notes },
      {
        onSuccess: () => {
          setMethod(""); setReference(""); setNotes("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark invoice as paid</DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p>Net payout: <span className="font-semibold">{formatCAD(invoice.netAmount)}</span></p>
              <p className="text-xs text-muted-foreground">
                Gross {formatCAD(invoice.grossAmount)} − fee {invoice.feePercent}% ({formatCAD(invoice.feeAmount)})
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="e.g. e-Transfer, Bank wire, Cash" />
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction # or note" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={markPaid.isPending}>
            {markPaid.isPending ? "Saving..." : "Mark as paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
