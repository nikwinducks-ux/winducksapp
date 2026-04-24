import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useCustomerTags, useCreateCustomerTag, useUpdateCustomerTag, useDeleteCustomerTag,
  TAG_COLOR_OPTIONS, tagColorClass,
} from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";

export default function CustomerTags() {
  const { data: tags = [], isLoading } = useCustomerTags();
  const createTag = useCreateCustomerTag();
  const updateTag = useUpdateCustomerTag();
  const deleteTag = useDeleteCustomerTag();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("primary");

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setColor("primary");
    setDialogOpen(true);
  };

  const openEdit = (id: string, currentName: string, currentColor: string) => {
    setEditingId(id);
    setName(currentName);
    setColor(currentColor);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await updateTag.mutateAsync({ id: editingId, name: name.trim(), color });
    } else {
      await createTag.mutateAsync({ name: name.trim(), color });
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Customer Tags</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tags.length} tag{tags.length === 1 ? "" : "s"}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New tag</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit tag" : "Create tag"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VIP" />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setColor(opt.value)}
                      className={`status-badge cursor-pointer border ${opt.className} ${color === opt.value ? "ring-2 ring-ring ring-offset-1" : ""}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!name.trim()}>{editingId ? "Save" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="metric-card">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No tags yet. Create one to get started.</p>
        ) : (
          <ul className="divide-y">
            {tags.map((tag) => (
              <li key={tag.id} className="flex items-center justify-between py-3">
                <span className={`status-badge border ${tagColorClass(tag.color)}`}>{tag.name}</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(tag.id, tag.name, tag.color)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{tag.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the tag from the catalog. Existing customers tagged with this name will keep the value but it will display as a plain badge.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteTag.mutate(tag.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
