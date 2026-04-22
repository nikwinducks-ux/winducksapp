import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getJobPhotoUrl, type JobPhoto } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { X, Upload, ImageIcon } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export interface JobPhotosUploaderState {
  newFiles: File[];
  newCaptions: string[];
  keepIds: string[];
  updatedCaptions: Record<string, string>;
}

interface Props {
  existing: JobPhoto[];
  onChange: (state: JobPhotosUploaderState) => void;
}

export function JobPhotosUploader({ existing, onChange }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newCaptions, setNewCaptions] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [keepIds, setKeepIds] = useState<string[]>(() => existing.map((p) => p.id));
  const [updatedCaptions, setUpdatedCaptions] = useState<Record<string, string>>({});

  useEffect(() => {
    setKeepIds(existing.map((p) => p.id));
    const init: Record<string, string> = {};
    existing.forEach((p) => (init[p.id] = p.caption));
    setUpdatedCaptions(init);
  }, [existing.length]);

  useEffect(() => {
    onChange({ newFiles, newCaptions, keepIds, updatedCaptions });
  }, [newFiles, newCaptions, keepIds, updatedCaptions]);

  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: File[] = [];
    const previewUrls: string[] = [];
    for (const f of Array.from(files)) {
      if (!ALLOWED.includes(f.type) && !f.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: `${f.name} is not an image`, variant: "destructive" });
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast({ title: "Too large", description: `${f.name} exceeds 5MB`, variant: "destructive" });
        continue;
      }
      accepted.push(f);
      previewUrls.push(URL.createObjectURL(f));
    }
    setNewFiles((prev) => [...prev, ...accepted]);
    setNewCaptions((prev) => [...prev, ...accepted.map(() => "")]);
    setPreviews((prev) => [...prev, ...previewUrls]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeNew = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setNewFiles((p) => p.filter((_, i) => i !== idx));
    setNewCaptions((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const removeExisting = (id: string) => {
    setKeepIds((p) => p.filter((x) => x !== id));
  };

  const visibleExisting = existing.filter((p) => keepIds.includes(p.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Photos</h3>
          <span className="text-xs text-muted-foreground">
            ({visibleExisting.length + newFiles.length})
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Add Photos
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {visibleExisting.length === 0 && newFiles.length === 0 && (
        <p className="text-xs text-muted-foreground">No photos attached. JPG/PNG/WEBP, max 5MB each.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visibleExisting.map((p) => (
          <div key={p.id} className="space-y-1.5">
            <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              <img src={getJobPhotoUrl(p.storage_path)} alt={p.caption || "Job photo"} className="w-full h-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => removeExisting(p.id)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:opacity-90"
                aria-label="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              placeholder="Caption (optional)"
              value={updatedCaptions[p.id] ?? ""}
              onChange={(e) => setUpdatedCaptions((m) => ({ ...m, [p.id]: e.target.value }))}
              className="text-xs h-8"
            />
          </div>
        ))}
        {newFiles.map((f, i) => (
          <div key={`new-${i}`} className="space-y-1.5">
            <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-primary/40 bg-muted">
              <img src={previews[i]} alt={f.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeNew(i)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:opacity-90"
                aria-label="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">NEW</span>
            </div>
            <Input
              placeholder="Caption (optional)"
              value={newCaptions[i] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setNewCaptions((arr) => arr.map((c, j) => (j === i ? v : c)));
              }}
              className="text-xs h-8"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
