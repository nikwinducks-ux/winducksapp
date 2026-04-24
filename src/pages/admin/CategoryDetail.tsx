import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  useServiceCategories,
  useCategoryLineItems,
  useCreateLineItem,
  useUpdateLineItem,
  useDeleteLineItem,
} from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCAD } from "@/lib/currency";

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: categories = [] } = useServiceCategories();
  const category = categories.find((c) => c.id === id);
  const { data: items = [], isLoading } = useCategoryLineItems(id);
  const createItem = useCreateLineItem();
  const updateItem = useUpdateLineItem();
  const deleteItem = useDeleteLineItem();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrice, setEditPrice] = useState("");

  if (!category) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Link to="/admin/categories" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Service Categories
        </Link>
        <p className="text-muted-foreground">Category not found.</p>
      </div>
    );
  }

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    const priceNum = parseFloat(newPrice) || 0;
    createItem.mutate(
      {
        category_id: category.id,
        title,
        description: newDesc.trim(),
        price: priceNum,
        display_order: items.length + 1,
      },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDesc("");
          setNewPrice("");
          setShowAdd(false);
        },
      }
    );
  };

  const startEdit = (item: typeof items[number]) => {
    setEditId(item.id);
    setEditTitle(item.title || item.description || "");
    setEditDesc(item.description || "");
    setEditPrice(String(item.price));
  };

  const handleUpdate = (itemId: string) => {
    const title = editTitle.trim();
    if (!title) return;
    updateItem.mutate(
      { id: itemId, category_id: category.id, title, description: editDesc.trim(), price: parseFloat(editPrice) || 0 },
      { onSuccess: () => setEditId(null) }
    );
  };

  const handleDelete = (itemId: string) => {
    if (!confirm("Delete this line item?")) return;
    deleteItem.mutate({ id: itemId, category_id: category.id });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="space-y-2">
        <Link to="/admin/categories" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Service Categories
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-header">{category.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {category.code && <span className="font-mono">{category.code}</span>}
              {category.code && category.description && <span> · </span>}
              {category.description}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Line Items</h2>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Line Item
          </Button>
        </div>

        {showAdd && (
          <div className="metric-card space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Standard window cleaning" />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label>Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="e.g. Per window, exterior only" />
              </div>
              <div className="space-y-1.5">
                <Label>Price <span className="text-xs text-muted-foreground">(CAD)</span></Label>
                <Input type="number" step="0.01" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim() || createItem.isPending}>
                {createItem.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setNewTitle(""); setNewDesc(""); setNewPrice(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
        ) : items.length === 0 && !showAdd ? (
          <div className="metric-card text-center py-10">
            <p className="text-sm text-muted-foreground">No line items yet.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add your first line item
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="metric-card">
                {editId === item.id ? (
                  <div className="space-y-2">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" />
                    <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description (optional)" />
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="max-w-[140px]"
                        placeholder="Price (CAD)"
                      />
                      <Button size="sm" variant="ghost" onClick={() => handleUpdate(item.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium break-words">{item.title || item.description}</p>
                      {item.description && item.title && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <p className="font-mono text-sm shrink-0">{formatCAD(Number(item.price) || 0)}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
