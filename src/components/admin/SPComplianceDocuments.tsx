import { useState } from "react";
import {
  useSPComplianceDocs,
  useUpsertSPComplianceDoc,
  useDeleteSPComplianceDoc,
  useDownloadSPComplianceDoc,
  type SPComplianceDoc,
} from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Download, Pencil, Trash2, FileText } from "lucide-react";
import {
  complianceStateForDate,
  complianceLabel,
  complianceBadgeVariant,
} from "@/lib/compliance";

interface Props {
  spId: string;
  readOnly?: boolean;
}

interface FormState {
  id?: string;
  name: string;
  documentType: string;
  expiresOn: string;
  notes: string;
  file: File | null;
  currentFilePath?: string;
  currentFileName?: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  documentType: "",
  expiresOn: "",
  notes: "",
  file: null,
};

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SPComplianceDocuments({ spId, readOnly = false }: Props) {
  const { data: docs = [], isLoading } = useSPComplianceDocs(spId);
  const upsert = useUpsertSPComplianceDoc();
  const del = useDeleteSPComplianceDoc();
  const download = useDownloadSPComplianceDoc();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDel, setConfirmDel] = useState<SPComplianceDoc | null>(null);

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const startEdit = (doc: SPComplianceDoc) => {
    setForm({
      id: doc.id,
      name: doc.name,
      documentType: doc.documentType,
      expiresOn: doc.expiresOn ?? "",
      notes: doc.notes,
      file: null,
      currentFilePath: doc.filePath,
      currentFileName: doc.fileName,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    // Require a file when creating
    if (!form.id && !form.file) return;
    await upsert.mutateAsync({
      id: form.id,
      spId,
      name: form.name.trim(),
      documentType: form.documentType.trim(),
      expiresOn: form.expiresOn || null,
      notes: form.notes,
      file: form.file,
      currentFilePath: form.currentFilePath,
    });
    setOpen(false);
  };

  return (
    <div className="metric-card space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Compliance Documents</h2>
          <p className="text-xs text-muted-foreground">
            Insurance certificates, licenses, and other expiring documents.
          </p>
        </div>
        {!readOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={startAdd}>
                <Plus className="h-4 w-4 mr-2" /> Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{form.id ? "Edit Document" : "Add Document"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="doc-name">Name *</Label>
                  <Input
                    id="doc-name"
                    placeholder="e.g. General Liability Insurance"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={120}
                  />
                </div>
                <div>
                  <Label htmlFor="doc-type">Type</Label>
                  <Input
                    id="doc-type"
                    placeholder="e.g. Insurance, Certification, License"
                    value={form.documentType}
                    onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                    maxLength={60}
                  />
                </div>
                <div>
                  <Label htmlFor="doc-exp">Expiration date</Label>
                  <Input
                    id="doc-exp"
                    type="date"
                    value={form.expiresOn}
                    onChange={(e) => setForm({ ...form, expiresOn: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave blank if the document never expires.
                  </p>
                </div>
                <div>
                  <Label htmlFor="doc-file">
                    File {form.id ? "(replace)" : "*"}
                  </Label>
                  <Input
                    id="doc-file"
                    type="file"
                    accept="application/pdf,image/*,.doc,.docx"
                    onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
                  />
                  {form.id && form.currentFileName && !form.file && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Current: {form.currentFileName}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="doc-notes">Notes</Label>
                  <Textarea
                    id="doc-notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    maxLength={500}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={upsert.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={submit}
                  disabled={upsert.isPending || !form.name.trim() || (!form.id && !form.file)}
                >
                  {upsert.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
      ) : docs.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No compliance documents yet.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const state = complianceStateForDate(doc.expiresOn);
            return (
              <div
                key={doc.id}
                className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{doc.name}</span>
                    <StatusBadge label={complianceLabel(state)} variant={complianceBadgeVariant(state)} />
                    {doc.documentType && (
                      <span className="text-xs text-muted-foreground">{doc.documentType}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                    <span>
                      {doc.expiresOn ? `Expires ${doc.expiresOn}` : "No expiry"}
                    </span>
                    {doc.fileName && (
                      <span className="truncate">
                        {doc.fileName} · {formatBytes(doc.fileSize)}
                      </span>
                    )}
                  </div>
                  {doc.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{doc.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.filePath && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Download"
                      onClick={() =>
                        download.mutate({ filePath: doc.filePath, fileName: doc.fileName })
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  {!readOnly && (
                    <>
                      <Button size="sm" variant="ghost" title="Edit" onClick={() => startEdit(doc)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Delete"
                        onClick={() => setConfirmDel(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDel?.name}" and its attached file will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDel) {
                  del.mutate(
                    { id: confirmDel.id, spId, filePath: confirmDel.filePath },
                    { onSettled: () => setConfirmDel(null) }
                  );
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
