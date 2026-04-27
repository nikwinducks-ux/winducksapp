import { useState } from "react";
import { useProducts, useUpsertProduct, useDeleteProduct, type Product } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { formatCAD } from "@/lib/currency";
import { Link } from "react-router-dom";

const empty: Partial<Product> = { name: "", sku: "", description: "", unit_price: 0, taxable: true, active: true, image_url: "", display_order: 0 };

export default function Products() {
  const { data: products = [], isLoading } = useProducts();
  const upsert = useUpsertProduct();
  const del = useDeleteProduct();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Products</h1>
          <p className="text-sm text-muted-foreground">Catalog of physical products that can be added to estimates and invoices.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/estimates"><Button variant="outline" size="sm">Back to estimates</Button></Link>
          <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" />New product</Button>
        </div>
      </div>

      <div className="metric-card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No products yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">SKU</th>
                <th className="text-right p-3">Price</th>
                <th className="text-left p-3">Tax</th>
                <th className="text-left p-3">Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 font-mono text-xs">{p.sku || "—"}</td>
                  <td className="p-3 text-right">{formatCAD(p.unit_price)}</td>
                  <td className="p-3 text-xs">{p.taxable ? "Yes" : "No"}</td>
                  <td className="p-3">{p.active ? "✓" : "—"}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }} className="text-destructive">
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
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} product</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>SKU</Label><Input value={editing.sku || ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} /></div>
                <div><Label>Unit price</Label><Input type="number" step="0.01" value={editing.unit_price ?? 0} onChange={(e) => setEditing({ ...editing, unit_price: parseFloat(e.target.value) || 0 })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} /></div>
              <div><Label>Image URL</Label><Input value={editing.image_url || ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><Switch checked={editing.taxable ?? true} onCheckedChange={(v) => setEditing({ ...editing, taxable: v })} /><Label>Taxable</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><Label>Active</Label></div>
              </div>
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
