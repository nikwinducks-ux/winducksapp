import { useState } from "react";
import { useServiceCategories, useCreateServiceCategory, useUpdateServiceCategory } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Pencil, X, Check } from "lucide-react";

export default function ServiceCategories() {
  const { data: categories = [], isLoading } = useServiceCategories();
  const createCategory = useCreateServiceCategory();
  const updateCategory = useUpdateServiceCategory();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    createCategory.mutate(
      { name: newName.trim(), code: newCode.trim(), description: newDesc.trim(), display_order: categories.length + 1 },
      { onSuccess: () => { setNewName(""); setNewCode(""); setNewDesc(""); setShowAdd(false); } }
    );
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    updateCategory.mutate(
      { id, name: editName.trim(), code: editCode.trim(), description: editDesc.trim() },
      { onSuccess: () => setEditId(null) }
    );
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    updateCategory.mutate({ id, active: !currentActive });
  };

  const startEdit = (cat: any) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditCode(cat.code || "");
    setEditDesc(cat.description || "");
  };

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  const sorted = [...categories].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Service Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">{categories.filter((c) => c.active).length} active categories</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Add Category</Button>
      </div>

      {showAdd && (
        <div className="metric-card space-y-3">
          <h2 className="section-title">New Category</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Roof Cleaning" />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. rc" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief description" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || createCategory.isPending}>
              {createCategory.isPending ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((cat) => (
          <div key={cat.id} className={`metric-card flex items-center gap-4 ${!cat.active ? "opacity-60" : ""}`}>
            {editId === cat.id ? (
              <div className="flex-1 flex items-center gap-3">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-[180px]" />
                <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="Code" className="max-w-[80px] font-mono" />
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="max-w-[180px]" />
                <Button size="sm" variant="ghost" onClick={() => handleUpdate(cat.id)}><Check className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{cat.name}</p>
                    {cat.code && <span className="font-mono text-xs text-muted-foreground">({cat.code})</span>}
                    <StatusBadge label={cat.active ? "Active" : "Inactive"} variant={cat.active ? "valid" : "warning"} />
                  </div>
                  {cat.description && <p className="text-sm text-muted-foreground mt-0.5">{cat.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(cat)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleToggleActive(cat.id, cat.active)}>
                    {cat.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
