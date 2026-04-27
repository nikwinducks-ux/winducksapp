import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { fetchEstimateByToken, customerAcceptEstimate, customerDeclineEstimate } from "@/hooks/useEstimates";
import { computePackageTotals } from "@/lib/estimateTotals";
import { PackageTotals } from "@/components/estimates/PackageTotals";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCAD } from "@/lib/currency";
import { CheckCircle2, XCircle, Star, FileSignature } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PublicEstimate() {
  const { token } = useParams();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [selectedPkgId, setSelectedPkgId] = useState<string>("");
  const [optionalSel, setOptionalSel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchEstimateByToken(token).then((d) => {
      if (d?.error) { setErr(d.error); setLoading(false); return; }
      setData(d);
      const pkgs = d?.packages || [];
      // Default selection: recommended, else first
      const rec = pkgs.find((p: any) => p.package?.is_recommended) || pkgs[0];
      if (rec) setSelectedPkgId(rec.package.id);
      // Default optional items: their is_selected value
      const opt: Record<string, boolean> = {};
      pkgs.forEach((p: any) => p.items.forEach((it: any) => { if (it.is_optional) opt[it.id] = it.is_selected; }));
      setOptionalSel(opt);
      setLoading(false);
    }).catch((e) => { setErr(e.message); setLoading(false); });
  }, [token]);

  const est = data?.estimate;
  const company = data?.company;
  const customer = data?.customer;
  const pkgs = data?.packages || [];
  const appliedCodes = data?.applied_codes || [];
  const manualDiscounts = data?.manual_discounts || [];
  const selectedPkg = pkgs.find((p: any) => p.package.id === selectedPkgId);

  const itemsForCalc = useMemo(() => {
    if (!selectedPkg) return [];
    return selectedPkg.items.map((it: any) => ({
      ...it,
      is_selected: it.is_optional ? !!optionalSel[it.id] : true,
    }));
  }, [selectedPkg, optionalSel]);

  const totals = useMemo(() => {
    if (!selectedPkg || !est) return null;
    return computePackageTotals({
      items: itemsForCalc,
      packageDiscount: selectedPkg.package.package_discount_kind === "none" ? null : {
        kind: selectedPkg.package.package_discount_kind,
        value: selectedPkg.package.package_discount_value,
      },
      estimateDiscounts: manualDiscounts,
      appliedCodes,
      taxPct: est.tax_pct,
      depositKind: est.deposit_kind,
      depositValue: est.deposit_value,
    });
  }, [selectedPkg, itemsForCalc, est, manualDiscounts, appliedCodes]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (err) return <div className="min-h-screen flex items-center justify-center text-destructive">{err}</div>;
  if (!est) return null;

  const terminalStatus = est.status === "Accepted" || est.status === "Declined" || est.status === "Expired" || est.status === "Converted" || est.status === "Archived";

  if (accepted || est.status === "Accepted" || est.status === "Converted") {
    return <Confirmation kind="accepted" est={est} />;
  }
  if (declined || est.status === "Declined") {
    return <Confirmation kind="declined" est={est} />;
  }
  if (est.status === "Expired") {
    return <Confirmation kind="expired" est={est} />;
  }

  const handleAccept = async () => {
    if (!totals || !selectedPkg) return;
    setBusy(true);
    try {
      const selectedIds = itemsForCalc.filter((i: any) => i.is_selected).map((i: any) => i.id);
      await customerAcceptEstimate({
        token: token!, package_id: selectedPkg.package.id,
        selected_item_ids: selectedIds,
        total: totals.total, deposit: totals.depositDue,
      });
      setAccepted(true);
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await customerDeclineEstimate(token!, declineReason);
      setDeclined(true);
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-3 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Branded header */}
        <div className="bg-card rounded-lg border p-6 flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {company?.company_logo_url ? (
              <img src={company.company_logo_url} alt="" className="h-12 w-12 object-contain" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileSignature className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <p className="font-semibold">{company?.company_name || "Your Company"}</p>
              <p className="text-xs text-muted-foreground">{company?.company_email}{company?.company_phone && ` · ${company.company_phone}`}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Estimate</p>
            <p className="font-mono font-semibold">{est.estimate_number}</p>
            {est.expires_at && <p className="text-xs text-muted-foreground mt-1">Expires {new Date(est.expires_at).toLocaleDateString()}</p>}
          </div>
        </div>

        {/* Customer */}
        {customer && (
          <div className="bg-card rounded-lg border p-4 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Prepared for</p>
            <p className="font-semibold">{customer.name}</p>
            <p className="text-muted-foreground text-xs">
              {customer.address_street}, {customer.address_city} {customer.address_postal}
            </p>
          </div>
        )}

        {/* Package selector */}
        {pkgs.length > 1 && (
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm font-medium mb-2">Choose a package</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pkgs.map((p: any) => (
                <button
                  key={p.package.id}
                  type="button"
                  onClick={() => setSelectedPkgId(p.package.id)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    selectedPkgId === p.package.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm">{p.package.name}</p>
                    {p.package.is_recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] px-2 py-0.5">
                        <Star className="h-2.5 w-2.5 fill-current" /> Recommended
                      </span>
                    )}
                  </div>
                  {p.package.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.package.description}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected package detail */}
        {selectedPkg && (
          <div className="bg-card rounded-lg border p-4 space-y-3">
            <div>
              <p className="font-semibold">{selectedPkg.package.name}</p>
              {selectedPkg.package.description && <p className="text-sm text-muted-foreground">{selectedPkg.package.description}</p>}
            </div>
            <div className="space-y-2">
              {selectedPkg.items.map((it: any) => (
                <div key={it.id} className={`flex items-start gap-2 rounded-md border p-2 ${it.is_optional ? "bg-muted/20" : ""}`}>
                  {it.is_optional ? (
                    <Checkbox
                      checked={!!optionalSel[it.id]}
                      onCheckedChange={(c) => setOptionalSel((s) => ({ ...s, [it.id]: !!c }))}
                      className="mt-0.5"
                    />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-medium">{it.name || "(unnamed)"}</p>
                      <p className="text-sm">{formatCAD(it.quantity * it.unit_price)}</p>
                    </div>
                    {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                    <p className="text-[10px] text-muted-foreground">
                      {it.quantity} × {formatCAD(it.unit_price)}
                      {it.is_optional && " · Optional"}
                      {!it.taxable && " · No tax"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {totals && (
              <div className="border-t pt-3">
                <PackageTotals totals={totals} depositKind={est.deposit_kind} />
              </div>
            )}
          </div>
        )}

        {/* Notes & terms */}
        {est.customer_notes && (
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs font-medium mb-1">Notes</p>
            <p className="text-sm whitespace-pre-line">{est.customer_notes}</p>
          </div>
        )}
        {est.terms && (
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs font-medium mb-1">Terms & Conditions</p>
            <p className="text-xs text-muted-foreground whitespace-pre-line">{est.terms}</p>
          </div>
        )}

        {/* Action bar */}
        {!terminalStatus && (
          <div className="bg-card rounded-lg border p-4 sticky bottom-3 print:hidden">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleAccept} disabled={busy || !selectedPkg} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Accept estimate{totals ? ` · ${formatCAD(totals.total)}` : ""}
              </Button>
              <Button variant="outline" onClick={handleDecline} disabled={busy}>
                <XCircle className="h-4 w-4 mr-1" />Decline
              </Button>
            </div>
            <div className="mt-2">
              <Label className="text-[10px] text-muted-foreground">Decline reason (optional)</Label>
              <Textarea rows={1} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className="text-xs" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Confirmation({ kind, est }: { kind: "accepted" | "declined" | "expired"; est: any }) {
  const label = { accepted: "Estimate accepted", declined: "Estimate declined", expired: "This estimate has expired" }[kind];
  const Icon = kind === "accepted" ? CheckCircle2 : XCircle;
  const color = kind === "accepted" ? "text-success" : "text-muted-foreground";
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-card rounded-lg border p-8 text-center max-w-md">
        <Icon className={`h-12 w-12 mx-auto mb-3 ${color}`} />
        <p className="font-semibold text-lg">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">Estimate {est.estimate_number}</p>
        {kind === "accepted" && est.accepted_total != null && (
          <p className="text-sm mt-2">Accepted total: <strong>{formatCAD(est.accepted_total)}</strong></p>
        )}
      </div>
    </div>
  );
}
