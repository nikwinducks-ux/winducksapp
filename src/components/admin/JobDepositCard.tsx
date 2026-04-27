import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCAD } from "@/lib/currency";
import { useRecordJobDeposit } from "@/hooks/useJobDeposit";
import { Wallet, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";

export function JobDepositCard({
  jobId,
  depositDue,
  depositReceived,
  depositReceivedAt,
  sourceEstimateId,
}: {
  jobId: string;
  depositDue: number;
  depositReceived: number;
  depositReceivedAt?: string | null;
  sourceEstimateId?: string | null;
}) {
  const record = useRecordJobDeposit();
  const [amount, setAmount] = useState<string>(depositDue ? String(depositDue) : "");

  if (!depositDue && !depositReceived && !sourceEstimateId) return null;

  const remaining = Math.max(0, (depositDue || 0) - (depositReceived || 0));
  const isPaid = depositReceived > 0 && remaining <= 0;

  return (
    <div className="metric-card space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="section-title flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Deposit
        </h2>
        {sourceEstimateId && (
          <Link
            to={`/admin/estimates/${sourceEstimateId}`}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <LinkIcon className="h-3 w-3" /> From estimate
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Due</p>
          <p className="font-semibold">{formatCAD(depositDue || 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Received</p>
          <p className="font-semibold">{formatCAD(depositReceived || 0)}</p>
          {depositReceivedAt && (
            <p className="text-[11px] text-muted-foreground">
              {new Date(depositReceivedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className={`font-semibold ${remaining > 0 ? "text-warning" : "text-success"}`}>
            {formatCAD(remaining)}
          </p>
        </div>
      </div>

      {isPaid ? (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          Deposit recorded as received in full.
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => record.mutate({ job_id: jobId, amount: 0 })}
            disabled={record.isPending}
          >
            Reset
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Amount received (CAD)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <Button
            onClick={() => record.mutate({ job_id: jobId, amount: parseFloat(amount) || 0 })}
            disabled={record.isPending || !(parseFloat(amount) > 0)}
          >
            Mark received
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Record-only — no payment is processed. Online deposit collection can be wired up later.
      </p>
    </div>
  );
}
