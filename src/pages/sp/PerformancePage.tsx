import { MetricCard } from "@/components/MetricCard";
import { useServiceProviders } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, Clock, XCircle, Star, Zap, Shield, Scale } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function PerformancePage() {
  const { user } = useAuth();
  const { data: providers = [] } = useServiceProviders();
  const sp = providers.find((s) => s.id === user?.spId) ?? providers[0];
  if (!sp) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;

  const weeklyData = [
    { week: "W1", completed: 8, onTime: 7 },
    { week: "W2", completed: 10, onTime: 9 },
    { week: "W3", completed: 7, onTime: 7 },
    { week: "W4", completed: 12, onTime: 11 },
  ];

  const ratingTrend = [
    { month: "Oct", rating: 4.6 },
    { month: "Nov", rating: 4.7 },
    { month: "Dec", rating: 4.7 },
    { month: "Jan", rating: 4.8 },
    { month: "Feb", rating: 4.8 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">Performance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your performance metrics over the last 30 days</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Completion Rate" value={`${sp.completionRate}%`} icon={<CheckCircle className="h-5 w-5" />} />
        <MetricCard label="On-Time Rate" value={`${sp.onTimeRate}%`} icon={<Clock className="h-5 w-5" />} />
        <MetricCard label="Cancellation Rate" value={`${sp.cancellationRate}%`} icon={<XCircle className="h-5 w-5" />} />
        <MetricCard label="Average Rating" value={sp.rating.toFixed(1)} icon={<Star className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Offer Response Time" value={sp.avgResponseTime} icon={<Zap className="h-5 w-5" />} />
        <MetricCard label="Reliability Index" value={sp.reliabilityScore} icon={<Shield className="h-5 w-5" />} />
        <MetricCard label="Fairness Share (30d)" value={`${sp.fairnessShare}%`} icon={<Scale className="h-5 w-5" />} subtitle={sp.fairnessStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="metric-card">
          <h2 className="section-title mb-4">Weekly Completions</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="onTime" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card">
          <h2 className="section-title mb-4">Rating Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={ratingTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[4, 5]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line type="monotone" dataKey="rating" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
