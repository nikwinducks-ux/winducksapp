import { useParams, Link } from "react-router-dom";
import { useJobs } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { SPJobDetailContent } from "@/components/sp/SPJobDetailContent";

export default function SPJobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useJobs();

  const job = jobs.find((j) => j.dbId === id || j.id === id);

  if (!user?.spId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 metric-card max-w-lg mx-auto text-center space-y-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-semibold text-destructive">Account Not Linked</p>
        <p className="text-sm text-muted-foreground">Your account is not linked to a Service Provider profile. Contact admin.</p>
      </div>
    );
  }

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Job not found</p>
        <Link to="/my-jobs" className="text-primary hover:underline mt-2 text-sm">Back to My Jobs</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <Link to="/my-jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to My Jobs
      </Link>
      <SPJobDetailContent job={job} variant="page" />
    </div>
  );
}
