import { useAuth } from "@/contexts/AuthContext";
import { useServiceProviders } from "@/hooks/useSupabaseData";
import SPAvailabilityEditor from "@/components/admin/SPAvailabilityEditor";

export default function AvailabilitySettings() {
  const { user } = useAuth();
  const { data: providers = [], isLoading } = useServiceProviders();
  const sp = providers.find((s) => s.id === user?.spId) ?? providers[0];

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  if (!sp) return <div className="py-20 text-center text-muted-foreground">No provider linked to your account.</div>;

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-header">Availability Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure your weekly schedule and capacity</p>
      </div>
      <SPAvailabilityEditor spId={sp.id} />
    </div>
  );
}
