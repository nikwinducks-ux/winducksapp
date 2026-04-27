import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRecordInvoicePayment } from "@/hooks/useInvoices";
import { formatCAD } from "@/lib/currency";

export function RecordPaymentDialog({
  open, onOpenChange, invoiceId, balanceDue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  balanceDue: number;
}) {
  const record = useRecordInvoicePayment();
  const [amount, setAmount] = useState(balanceDue);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { if (open) setAmount(balanceDue); }, [open, balanceDue]);

  const submit = async () => {
    if (amount <= 0) return;
    await record.mutateAsync({
      invoice_id: invoiceId, amount, method, reference, notes, payment_date: paymentDate,
    });
    onOpenChange(false);
    setMethod(""); setReference(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            Outstanding balance: <span className="font-semibold text-foreground">{formatCAD(balanceDue)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Payment date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Method</Label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Cash, e-Transfer, Card" />
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID / cheque #" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={record.isPending || amount <= 0}>Record payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
