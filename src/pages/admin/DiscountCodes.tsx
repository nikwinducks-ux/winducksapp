import { useState } from "react";
import { useDiscountCodes, useUpsertDiscountCode, useDeleteDiscountCode, type DiscountCode } from "@/hooks/useDiscountCodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { formatCAD } from "@/lib/currency";
import { Link } from "react-router-dom";

const empty: Partial<DiscountCode> = { code: "", kind: "percent", value: 10, applies_to: "all", min_subtotal: 0, max_uses: null, active: true, expires_at: null, notes: "" };

export default function DiscountCodes() {
  const { data: codes = [], isLoading } = useDiscountCodes();
  const upsert = useUpsertDiscountCode();
  const del = useDeleteDiscountCode();
  const [editing, setEditing] = useState<Partial<DiscountCode> | null>(null);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Discount Codes</h1>
          <p className="text-sm text-muted-foreground">Reusable codes that can be applied to estimates.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/estimates"><Button variant="outline" size="sm">Back to estimates</Button></Link>
          <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" />New code</Button>
        </div>
      </div>

      <div className="metric-card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : codes.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No discount codes yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Discount</th>
                <th className="text-left p-3">Applies to</th>
                <th className="text-left p-3">Uses</th>
                <th className="text-left p-3">Expires</th>
                <th className="text-left p-3">Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono font-semibold">{c.code}</td>
                  <td className="p-3">{c.kind === "percent" ? `${c.value}%` : formatCAD(c.value)}</td>
                  <td className="p-3 text-xs">{c.applies_to}</td>
                  <td className="p-3 text-xs">{c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                  <td className="p-3 text-xs text-muted-foreground">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                  <td className="p-3">{c.active ? "✓" : "—"}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete code ${c.code}?`)) del.mutate(c.id); }} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} discount code</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Code</Label><Input className="font-mono uppercase" value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Type</Label>
                  <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Value</Label><Input type="number" step="0.01" value={editing.value ?? 0} onChange={(e) => setEditing({ ...editing, value: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Applies to</Label>
                  <Select value={editing.applies_to} onValueChange={(v) => setEditing({ ...editing, applies_to: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All items</SelectItem>
                      <SelectItem value="services">Services only</SelectItem>
                      <SelectItem value="products">Products only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Min subtotal</Label><Input type="number" step="0.01" value={editing.min_subtotal ?? 0} onChange={(e) => setEditing({ ...editing, min_subtotal: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Max uses (blank = unlimited)</Label><Input type="number" value={editing.max_uses ?? ""} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value ? parseInt(e.target.value) : null })} /></div>
                <div><Label>Expires</Label><Input type="date" value={editing.expires_at ? editing.expires_at.slice(0, 10) : ""} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Active</Label>
              </div>
              <div><Label>Internal notes</Label><Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={async () => { if (editing) { await upsert.mutateAsync(editing); setEditing(null); } }} disabled={upsert.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
