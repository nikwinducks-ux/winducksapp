import { useJobPhotos } from "@/hooks/useSupabaseData";
import { JobPhotosGallery } from "@/components/JobPhotosGallery";
import { Image as ImageIcon } from "lucide-react";

interface Props {
  jobId: string | undefined;
  hideWhenEmpty?: boolean;
}

export function JobPhotosCard({ jobId, hideWhenEmpty = true }: Props) {
  const { data: photos = [] } = useJobPhotos(jobId);
  if (hideWhenEmpty && photos.length === 0) return null;
  return (
    <div className="metric-card space-y-3">
      <h2 className="section-title flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />Photos
      </h2>
      <JobPhotosGallery photos={photos} />
    </div>
  );
}
