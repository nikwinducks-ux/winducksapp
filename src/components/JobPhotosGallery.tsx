import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getJobPhotoUrl, type JobPhoto } from "@/hooks/useSupabaseData";
import { ImageIcon } from "lucide-react";

interface Props {
  photos: JobPhoto[];
}

export function JobPhotosGallery({ photos }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <ImageIcon className="h-4 w-4" /> No photos attached
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {photos.map((p, i) => {
          const url = getJobPhotoUrl(p.storage_path);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted hover:ring-2 hover:ring-primary transition-all"
            >
              <img
                src={url}
                alt={p.caption || "Job photo"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
              {p.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
                  {p.caption}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(o) => !o && setOpenIndex(null)}>
        <DialogContent className="max-w-4xl p-2">
          {openIndex !== null && photos[openIndex] && (
            <div className="space-y-2">
              <img
                src={getJobPhotoUrl(photos[openIndex].storage_path)}
                alt={photos[openIndex].caption || "Job photo"}
                className="w-full max-h-[80vh] object-contain rounded"
              />
              {photos[openIndex].caption && (
                <p className="text-sm text-muted-foreground text-center px-2 pb-2">
                  {photos[openIndex].caption}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
