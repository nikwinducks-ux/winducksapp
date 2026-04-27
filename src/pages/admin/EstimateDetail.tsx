import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  useEstimate, useEstimatePackages, useEstimateLineItems, useEstimateAppliedCodes,
  useUpdateEstimate, useUpsertPackage, useDeletePackage, useDuplicatePackage,
  useReplaceLineItems, useApplyDiscountCode, useRemoveAppliedCode,
  useMarkEstimateSent, useDeleteEstimate, useManualAcceptEstimate, useManualDeclineEstimate,
  type EstimatePackage,
} from "@/hooks/useEstimates";
import { useCustomers } from "@/hooks/useSupabaseData";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCAD } from "@/lib/currency";
import { ArrowLeft, Save, Send, Plus, Trash2, Copy, CheckCircle2, XCircle, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EstimatePackageCard, type EditableLine } from "@/components/estimates/EstimatePackageCard";
import { DiscountCodeInput } from "@/components/estimates/DiscountCodeInput";
import { DepositConfig } from "@/components/estimates/DepositConfig";
import { ConvertEstimateDialog } from "@/components/estimates/ConvertEstimateDialog";
import { computePackageTotals } from "@/lib/estimateTotals";
import { WorkflowStepper, buildEstimateStages } from "@/components/workflow/WorkflowStepper";
import { ActivityTimelineCard } from "@/components/workflow/ActivityTimeline";
import { useEstimateEvents } from "@/hooks/useWorkflowEvents";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function useLinkedInvoiceForEstimate(estimateId: string | undefined) {
  return useQuery({
    queryKey: ["linked_invoice_for_estimate", estimateId],
    queryFn: async () => {
      if (!estimateId) return null;
      const { data } = await supabase
        .from("customer_invoices")
        .select("id")
        .eq("source_estimate_id", estimateId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!estimateId,
  });
}

const STATUS_VARIANT: Record<string, "neutral" | "info" | "valid" | "warning" | "error"> = {
  Draft: "neutral", Sent: "info", Viewed: "info", Accepted: "valid",
  Declined: "error", Expired: "warning", Converted: "valid", Archived: "neutral",
};

export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: estimate, isLoading } = useEstimate(id);
  const { data: packages = [] } = useEstimatePackages(id);
  const pkgIds = useMemo(() => packages.map((p) => p.id), [packages]);
  const { data: dbItems = [] } = useEstimateLineItems(pkgIds);
  const { data: appliedCodes = [] } = useEstimateAppliedCodes(id);
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: events = [], isLoading: eventsLoading } = useEstimateEvents(id);
  const { data: linkedInvoiceId } = useLinkedInvoiceForEstimate(id);

  const update = useUpdateEstimate();
  const upsertPkg = useUpsertPackage();
  const deletePkg = useDeletePackage();
  const duplicatePkg = useDuplicatePackage();
  const replaceItems = useReplaceLineItems();
  const applyCode = useApplyDiscountCode();
  const removeCode = useRemoveAppliedCode();
  const markSent = useMarkEstimateSent();
  const del = useDeleteEstimate();
  const accept = useManualAcceptEstimate();
  const decline = useManualDeclineEstimate();

  // local editable state
  const [customerId, setCustomerId] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [taxPct, setTaxPct] = useState(5);
  const [depositKind, setDepositKind] = useState<"none" | "fixed" | "percent">("none");
  const [depositValue, setDepositValue] = useState(0);
  const [packageState, setPackageState] = useState<Record<string, EstimatePackage>>({});
  const [itemsState, setItemsState] = useState<Record<string, EditableLine[]>>({});
  const [convertOpen, setConvertOpen] = useState(false);

  useEffect(() => {
    if (estimate) {
      setCustomerId(estimate.customer_id ?? "");
      setExpiresAt(estimate.expires_at ?? "");
      setInternalNotes(estimate.internal_notes ?? "");
      setCustomerNotes(estimate.customer_notes ?? "");
      setTerms(estimate.terms ?? "");
      setTaxPct(Number(estimate.tax_pct ?? 5));
      setDepositKind((estimate.deposit_kind as any) ?? "none");
      setDepositValue(Number(estimate.deposit_value ?? 0));
    }
  }, [estimate?.id]);

  useEffect(() => {
    const map: Record<string, EstimatePackage> = {};
    packages.forEach((p) => { map[p.id] = p; });
    setPackageState(map);
  }, [packages]);

  useEffect(() => {
    const map: Record<string, EditableLine[]> = {};
    pkgIds.forEach((pid) => { map[pid] = []; });
    dbItems.forEach((li) => {
      if (!map[li.package_id]) map[li.package_id] = [];
      map[li.package_id].push({ ...li });
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.display_order - b.display_order));
    setItemsState(map);
  }, [dbItems, pkgIds.join(",")]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading estimate…</div>;
  if (!estimate) return (
    <div className="space-y-3">
      <p className="text-muted-foreground">Estimate not found.</p>
      <Link to="/admin/estimates" className="text-primary hover:underline text-sm">Back</Link>
    </div>
  );

  const isDraft = estimate.status === "Draft";
  const isSent = estimate.status === "Sent" || estimate.status === "Viewed";
  const isAccepted = estimate.status === "Accepted";
  const isConverted = estimate.status === "Converted";
  const editable = isDraft;
  const customer = customers.find((c) => c.id === customerId);
  const publicUrl = `${window.location.origin}/estimate/${estimate.share_token}`;

  // Aggregate totals across packages (using winning if accepted, else sum-by-package shown individually)
  const totalsByPackage = packages.map((p) => ({
    pkg: packageState[p.id] || p,
    totals: computePackageTotals({
      items: itemsState[p.id] || [],
      packageDiscount: (packageState[p.id]?.package_discount_kind ?? p.package_discount_kind) === "none"
        ? null
        : { kind: (packageState[p.id]?.package_discount_kind ?? p.package_discount_kind) as any,
            value: packageState[p.id]?.package_discount_value ?? p.package_discount_value },
      appliedCodes,
      taxPct,
      depositKind,
      depositValue,
    }),
  }));

  const handleSaveAll = async () => {
    await update.mutateAsync({
      id: estimate.id,
      patch: {
        customer_id: customerId || null,
        expires_at: expiresAt || null,
        internal_notes: internalNotes,
        customer_notes: customerNotes,
        terms,
        tax_pct: taxPct,
        deposit_kind: depositKind,
        deposit_value: depositValue,
      },
    });
    // packages
    for (const p of packages) {
      const local = packageState[p.id];
      if (!local) continue;
      await upsertPkg.mutateAsync({
        id: p.id, estimate_id: estimate.id,
        name: local.name, description: local.description,
        is_recommended: local.is_recommended, display_order: local.display_order,
        package_discount_kind: local.package_discount_kind,
        package_discount_value: local.package_discount_value,
        package_discount_reason: local.package_discount_reason,
      });
      await replaceItems.mutateAsync({
        package_id: p.id,
        items: (itemsState[p.id] || []).map((it) => ({
          item_type: it.item_type, catalog_ref_id: it.catalog_ref_id,
          name: it.name, description: it.description,
          quantity: it.quantity, unit_price: it.unit_price,
          taxable: it.taxable, is_optional: it.is_optional,
          is_selected: it.is_selected, discount_allowed: it.discount_allowed,
          image_url: it.image_url, display_order: it.display_order,
        })),
      });
    }
    toast({ title: "Saved" });
  };

  const handleAddPackage = async () => {
    await upsertPkg.mutateAsync({
      estimate_id: estimate.id,
      name: `Package ${packages.length + 1}`,
      display_order: packages.length,
    });
  };

  const handleSetRecommended = async (pkgId: string) => {
    for (const p of packages) {
      await upsertPkg.mutateAsync({
        id: p.id, estimate_id: estimate.id,
        is_recommended: p.id === pkgId,
      });
    }
  };

  const handleSendLink = async () => {
    await handleSaveAll();
    await markSent.mutateAsync(estimate.id);
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Estimate marked as sent", description: "Public link copied to clipboard." });
  };

  const handleManualAccept = async () => {
    const recommended = packages.find((p) => p.is_recommended) ?? packages[0];
    if (!recommended) { toast({ title: "Add a package first", variant: "destructive" }); return; }
    const t = totalsByPackage.find((tp) => tp.pkg.id === recommended.id)?.totals;
    await accept.mutateAsync({
      id: estimate.id, package_id: recommended.id,
      total: t?.total ?? 0, deposit: t?.depositDue ?? 0,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <Link to="/admin/estimates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Estimates
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="page-header">{estimate.estimate_number}</h1>
          <StatusBadge label={estimate.status} variant={STATUS_VARIANT[estimate.status] || "neutral"} />
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={handleSaveAll} disabled={update.isPending || replaceItems.isPending}>
                <Save className="h-4 w-4 mr-1" />Save
              </Button>
              <Button size="sm" onClick={handleSendLink}>
                <Send className="h-4 w-4 mr-1" />Send (link)
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                if (!confirm("Delete this estimate?")) return;
                del.mutate(estimate.id, { onSuccess: () => navigate("/admin/estimates") });
              }} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {isSent && (
            <>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: "Link copied" }); }}>
                <Copy className="h-4 w-4 mr-1" />Copy link
              </Button>
              <Button size="sm" variant="outline" onClick={handleManualAccept}>
                <CheckCircle2 className="h-4 w-4 mr-1" />Mark accepted
              </Button>
              <Button size="sm" variant="outline" onClick={() => decline.mutate({ id: estimate.id })}>
                <XCircle className="h-4 w-4 mr-1" />Mark declined
              </Button>
            </>
          )}
          {isAccepted && (
            <Button size="sm" onClick={() => setConvertOpen(true)}>
              <Briefcase className="h-4 w-4 mr-1" />Convert to job
            </Button>
          )}
          {isConverted && estimate.converted_job_id && (
            <Link to={`/admin/jobs/${estimate.converted_job_id}`}>
              <Button size="sm" variant="outline"><Briefcase className="h-4 w-4 mr-1" />View job</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="metric-card grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId} disabled={!editable}>
            <SelectTrigger><SelectValue placeholder="Pick a customer" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {customer && (
            <p className="text-xs text-muted-foreground mt-1">
              {customer.email || "(no email)"} {customer.phone && `· ${customer.phone}`}<br />
              {customer.serviceAddress.street}, {customer.serviceAddress.city}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Expires on</Label>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={!editable} />
          <Label className="text-xs mt-2 block">Tax %</Label>
          <Input type="number" step="0.01" value={taxPct} onChange={(e) => setTaxPct(parseFloat(e.target.value) || 0)} disabled={!editable} />
        </div>
      </div>

      {/* Packages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Packages ({packages.length})</h2>
          {editable && (
            <Button size="sm" variant="outline" onClick={handleAddPackage}>
              <Plus className="h-4 w-4 mr-1" />Add package
            </Button>
          )}
        </div>
        {packages.map((p) => {
          const local = packageState[p.id] || p;
          const items = itemsState[p.id] || [];
          return (
            <EstimatePackageCard
              key={p.id}
              pkg={local}
              items={items}
              products={products}
              taxPct={taxPct}
              depositKind={depositKind}
              depositValue={depositValue}
              locked={!editable}
              onPackageChange={(patch) => setPackageState((s) => ({ ...s, [p.id]: { ...local, ...patch } }))}
              onItemsChange={(next) => setItemsState((s) => ({ ...s, [p.id]: next }))}
              onDelete={() => { if (confirm(`Delete "${local.name}"?`)) deletePkg.mutate({ id: p.id, estimate_id: estimate.id }); }}
              onDuplicate={() => duplicatePkg.mutate({ package_id: p.id, estimate_id: estimate.id })}
              onSetRecommended={() => handleSetRecommended(p.id)}
            />
          );
        })}
        {packages.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-6">No packages yet.</p>
        )}
      </div>

      {/* Estimate-wide settings */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="metric-card space-y-3">
          <h2 className="section-title">Discount codes</h2>
          <DiscountCodeInput
            applied={appliedCodes}
            onApply={(code) => applyCode.mutate({ estimate_id: estimate.id, code })}
            onRemove={(rid) => removeCode.mutate({ id: rid, estimate_id: estimate.id })}
            disabled={!editable}
          />
        </div>
        <div className="metric-card space-y-3">
          <h2 className="section-title">Deposit</h2>
          <DepositConfig
            kind={depositKind}
            value={depositValue}
            onChange={(k, v) => { setDepositKind(k); setDepositValue(v); }}
            disabled={!editable}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="metric-card space-y-2">
          <Label className="text-xs">Customer-facing notes</Label>
          <Textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={3} disabled={!editable} />
        </div>
        <div className="metric-card space-y-2">
          <Label className="text-xs">Terms & conditions</Label>
          <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} disabled={!editable} />
        </div>
      </div>

      <div className="metric-card space-y-2">
        <Label className="text-xs">Internal notes (not visible to customer)</Label>
        <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} disabled={!editable} />
      </div>

      {(isSent || isAccepted || isConverted) && (
        <div className="metric-card space-y-2">
          <h2 className="section-title">Public link</h2>
          <div className="flex gap-2">
            <Input value={publicUrl} readOnly className="font-mono text-xs" />
            <Button onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: "Copied" }); }} variant="outline" size="sm">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isAccepted && (
        <div className="metric-card bg-success/5 border-success/30">
          <p className="text-sm">
            <strong>Accepted</strong>
            {estimate.accepted_at && ` · ${new Date(estimate.accepted_at).toLocaleString()}`}
            {estimate.accepted_total != null && ` · Total ${formatCAD(estimate.accepted_total)}`}
          </p>
        </div>
      )}

      <ConvertEstimateDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        estimateId={estimate.id}
        customerId={customerId || null}
        onConverted={(jobId) => navigate(`/admin/jobs/${jobId}`)}
      />
    </div>
  );
}
