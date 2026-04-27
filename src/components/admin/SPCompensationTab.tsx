import { useEffect, useMemo, useState } from "react";
import {
  useServiceProvider,
  useAppSettings,
  useUpdateSPCompensation,
  useSPExpenses,
  useUpsertSPExpense,
  useDeleteSPExpense,
  useToggleSPExpense,
  type SPExpense,
  type SPExpenseType,
} from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCAD } from "@/lib/currency";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";

interface Props {
  spId: string;
  readOnly?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function SPCompensationTab({ spId, readOnly = false }: Props) {
  const { data: sp } = useServiceProvider(spId);
  const { data: settings } = useAppSettings();
  const updateComp = useUpdateSPCompensation();

  const defaults = {
    platform: settings?.defaultPlatformFeePct ?? 15,
    marketing: settings?.defaultMarketingPct ?? 20,
    sp: settings?.defaultSpPortionPct ?? 65,
  };

  // Effective values (per-SP override or fall back to defaults)
  const effective = useMemo(
    () => ({
      platform: sp?.compPlatformFeePct ?? defaults.platform,
      marketing: sp?.compMarketingPct ?? defaults.marketing,
      sp: sp?.compSpPortionPct ?? defaults.sp,
    }),
    [sp, settings],
  );
  const usingDefaults =
    sp?.compPlatformFeePct == null &&
    sp?.compMarketingPct == null &&
    sp?.compSpPortionPct == null;
  const platformUsesDefault = sp?.compPlatformFeePct == null;
  const marketingUsesDefault = sp?.compMarketingPct == null;

  // Edit state
  const [editing, setEditing] = useState(false);
  const [platform, setPlatform] = useState<string>("");
  const [marketing, setMarketing] = useState<string>("");
  const [spPct, setSpPct] = useState<string>("");

  useEffect(() => {
    if (!editing) {
      setPlatform(String(effective.platform));
      setMarketing(String(effective.marketing));
      setSpPct(String(effective.sp));
    }
  }, [editing, effective.platform, effective.marketing, effective.sp]);

  const total = round2(
    (Number(platform) || 0) + (Number(marketing) || 0) + (Number(spPct) || 0),
  );
  const totalValid = Math.abs(total - 100) < 0.01;

  const handleSave = () => {
    updateComp.mutate(
      {
        spId,
        compPlatformFeePct: Number(platform),
        compMarketingPct: Number(marketing),
        compSpPortionPct: Number(spPct),
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Compensation Split */}
      <div className="metric-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Compensation Split</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each completed job's invoice is split into these three portions. Must total 100%.
              {usingDefaults && (
                <span className="ml-1 text-warning">Using global defaults — no per-SP override set.</span>
              )}
            </p>
          </div>
          {!readOnly && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
          )}
        </div>

        {!editing ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Global Platform Fee %"
              value={`${effective.platform}%`}
              hint={platformUsesDefault ? "Global default — set on Payouts page" : "Per-SP override"}
            />
            <Field
              label="Marketing %"
              value={`${effective.marketing}%`}
              hint={marketingUsesDefault ? "Global default — set on Payouts page" : "Per-SP override"}
            />
            <Field label="Service Provider Portion %" value={`${effective.sp}%`} />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <PctInput
                label="Global Platform Fee %"
                value={platform}
                onChange={setPlatform}
                hint={
                  platformUsesDefault
                    ? `Default ${defaults.platform}% from Payouts. Saving will create a per-SP override.`
                    : "Per-SP override. Clear by matching the global default on the Payouts page."
                }
              />
              <PctInput
                label="Marketing %"
                value={marketing}
                onChange={setMarketing}
                hint={
                  marketingUsesDefault
                    ? `Default ${defaults.marketing}% from Payouts. Saving will create a per-SP override.`
                    : "Per-SP override. Clear by matching the global default on the Payouts page."
                }
              />
              <PctInput
                label="Service Provider Portion %"
                value={spPct}
                onChange={setSpPct}
              />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <StatusBadge
                label={
                  totalValid
                    ? `Total: 100%`
                    : `Total: ${total}% (must equal 100%)`
                }
                variant={totalValid ? "valid" : "error"}
              />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  <X className="h-4 w-4 mr-2" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!totalValid || updateComp.isPending}
                >
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Expenses */}
      <ExpensesCard spId={spId} readOnly={readOnly} />

      {/* Job Payout Preview */}
      <PayoutPreview
        spId={spId}
        platformPct={effective.platform}
        marketingPct={effective.marketing}
        spPct={effective.sp}
      />
    </div>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PctInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        max={100}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ============================================================
// Expenses
// ============================================================

interface DraftExpense {
  id?: string;
  name: string;
  expenseType: SPExpenseType;
  value: string;
  active: boolean;
}

const emptyDraft: DraftExpense = {
  name: "",
  expenseType: "percent_of_sp",
  value: "",
  active: true,
};

function ExpensesCard({ spId, readOnly }: { spId: string; readOnly: boolean }) {
  const { data: expenses = [], isLoading } = useSPExpenses(spId);
  const { data: settings } = useAppSettings();
  const subscriptionFee = settings?.defaultSubscriptionFeeMonthly ?? 0;
  const upsert = useUpsertSPExpense();
  const remove = useDeleteSPExpense();
  const toggle = useToggleSPExpense();

  const [draft, setDraft] = useState<DraftExpense | null>(null);

  const startAdd = () => setDraft({ ...emptyDraft });
  const startEdit = (e: SPExpense) =>
    setDraft({
      id: e.id,
      name: e.name,
      expenseType: e.expenseType,
      value: String(e.value),
      active: e.active,
    });
  const cancel = () => setDraft(null);

  const submit = () => {
    if (!draft) return;
    if (!draft.name.trim()) return;
    const numValue = Number(draft.value);
    if (Number.isNaN(numValue) || numValue < 0) return;
    upsert.mutate(
      {
        id: draft.id,
        spId,
        name: draft.name.trim(),
        expenseType: draft.expenseType,
        value: draft.expenseType === "percent_of_sp" ? Math.min(numValue, 100) : numValue,
        active: draft.active,
      },
      { onSuccess: () => setDraft(null) },
    );
  };

  return (
    <div className="metric-card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Expenses</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Percentage expenses reduce the SP portion on each completed job. Monthly fixed expenses
            are tracked separately and not deducted per job.
          </p>
        </div>
        {!readOnly && !draft && (
          <Button variant="outline" size="sm" onClick={startAdd}>
            <Plus className="h-4 w-4 mr-2" /> Add expense
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
      ) : expenses.length === 0 && !draft ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No expenses configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3 text-right">Value</th>
                <th className="py-2 pr-3">Active</th>
                {!readOnly && <th className="py-2 pr-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) =>
                draft?.id === e.id ? (
                  <DraftRow
                    key={e.id}
                    draft={draft}
                    setDraft={setDraft}
                    onCancel={cancel}
                    onSubmit={submit}
                    pending={upsert.isPending}
                    readOnly={readOnly}
                  />
                ) : (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{e.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {e.expenseType === "percent_of_sp"
                        ? "% of SP portion"
                        : "Monthly fixed $"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {e.expenseType === "percent_of_sp"
                        ? `${e.value}%`
                        : `${formatCAD(e.value)}/mo`}
                    </td>
                    <td className="py-2 pr-3">
                      {readOnly ? (
                        <StatusBadge
                          label={e.active ? "Active" : "Inactive"}
                          variant={e.active ? "valid" : "neutral"}
                        />
                      ) : (
                        <Switch
                          checked={e.active}
                          onCheckedChange={(c) =>
                            toggle.mutate({ id: e.id, spId, active: c })
                          }
                        />
                      )}
                    </td>
                    {!readOnly && (
                      <td className="py-2 pr-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(e)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove.mutate({ id: e.id, spId })}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ),
              )}
              {draft && !draft.id && (
                <DraftRow
                  draft={draft}
                  setDraft={setDraft}
                  onCancel={cancel}
                  onSubmit={submit}
                  pending={upsert.isPending}
                  readOnly={readOnly}
                />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DraftRow({
  draft,
  setDraft,
  onCancel,
  onSubmit,
  pending,
  readOnly,
}: {
  draft: DraftExpense;
  setDraft: (d: DraftExpense) => void;
  onCancel: () => void;
  onSubmit: () => void;
  pending: boolean;
  readOnly: boolean;
}) {
  return (
    <tr className="border-b bg-muted/30">
      <td className="py-2 pr-3">
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="e.g. Insurance fee"
        />
      </td>
      <td className="py-2 pr-3">
        <Select
          value={draft.expenseType}
          onValueChange={(v) => setDraft({ ...draft, expenseType: v as SPExpenseType })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percent_of_sp">% of SP portion</SelectItem>
            <SelectItem value="monthly_fixed">Monthly fixed $</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="py-2 pr-3 text-right">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={draft.value}
          onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          className="text-right w-28 ml-auto"
        />
      </td>
      <td className="py-2 pr-3">
        <Switch
          checked={draft.active}
          onCheckedChange={(c) => setDraft({ ...draft, active: c })}
        />
      </td>
      {!readOnly && (
        <td className="py-2 pr-3 text-right space-x-1">
          <Button size="sm" onClick={onSubmit} disabled={pending}>
            <Save className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </td>
      )}
    </tr>
  );
}

// ============================================================
// Payout Preview
// ============================================================

function PayoutPreview({
  spId,
  platformPct,
  marketingPct,
  spPct,
}: {
  spId: string;
  platformPct: number;
  marketingPct: number;
  spPct: number;
}) {
  const { data: expenses = [] } = useSPExpenses(spId);
  const [sample, setSample] = useState<string>("100");
  const invoice = Number(sample) || 0;

  const platform = round2((invoice * platformPct) / 100);
  const marketing = round2((invoice * marketingPct) / 100);
  const grossSp = round2((invoice * spPct) / 100);

  const activePctTotal = Math.min(
    expenses
      .filter((e) => e.active && e.expenseType === "percent_of_sp")
      .reduce((s, e) => s + e.value, 0),
    100,
  );
  const expenseDeduction = round2((grossSp * activePctTotal) / 100);
  const finalSp = round2(grossSp - expenseDeduction);

  const monthlyFixed = expenses.filter(
    (e) => e.active && e.expenseType === "monthly_fixed",
  );
  const monthlyTotal = monthlyFixed.reduce((s, e) => s + e.value, 0);

  return (
    <div className="metric-card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Job Payout Preview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estimate of what the SP earns per completed job. Applies to future jobs only.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sample invoice</Label>
          <Input
            type="number"
            min={0}
            step="1"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            className="w-32"
          />
        </div>
      </div>

      <table className="w-full text-sm">
        <tbody>
          <Row label="Total invoice" value={formatCAD(invoice)} bold />
          <Row
            label={`− Global Platform Fee (${platformPct}%)`}
            value={`−${formatCAD(platform)}`}
            muted
          />
          <Row
            label={`− Marketing (${marketingPct}%)`}
            value={`−${formatCAD(marketing)}`}
            muted
          />
          <Row label={`= Gross SP portion (${spPct}%)`} value={formatCAD(grossSp)} bold />
          <Row
            label={`− Expense deductions (${activePctTotal}%)`}
            value={`−${formatCAD(expenseDeduction)}`}
            muted
          />
          <tr className="border-t">
            <td className="py-2 font-semibold">= Final SP earnings</td>
            <td className="py-2 text-right text-lg font-bold text-success">
              {formatCAD(finalSp)}
            </td>
          </tr>
        </tbody>
      </table>

      {monthlyFixed.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">
            Monthly fixed deductions (tracked separately, not deducted per job)
          </p>
          <ul className="text-sm space-y-1">
            {monthlyFixed.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span>{e.name}</span>
                <span className="text-muted-foreground">{formatCAD(e.value)}/mo</span>
              </li>
            ))}
            <li className="flex justify-between border-t pt-1 mt-1 font-semibold">
              <span>Monthly total</span>
              <span>{formatCAD(monthlyTotal)}/mo</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <tr>
      <td className={`py-1.5 ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
        {label}
      </td>
      <td className={`py-1.5 text-right ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
        {value}
      </td>
    </tr>
  );
}
