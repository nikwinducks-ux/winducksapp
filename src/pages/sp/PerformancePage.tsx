import { useMemo, useState } from "react";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { MetricCard } from "@/components/MetricCard";
import { useServiceProviders, useJobs } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, Clock, XCircle, Star, Zap, Shield, Scale, CheckCircle2, DollarSign, CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Timeframe = "7d" | "30d" | "12mo" | "custom";

export default function PerformancePage() {
  const { user } = useAuth();
  const { data: providers = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();
  const sp = providers.find((s) => s.id === user?.spId) ?? providers[0];

  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (timeframe === "custom" && customStart && customEnd) {
      return { startDate: startOfDay(customStart), endDate: endOfDay(customEnd) };
    }
    if (timeframe === "7d") return { startDate: startOfDay(subDays(now, 7)), endDate: now };
    if (timeframe === "12mo") return { startDate: startOfDay(subMonths(now, 12)), endDate: now };
    return { startDate: startOfDay(subDays(now, 30)), endDate: now };
  }, [timeframe, customStart, customEnd]);

  const { totalCompleted, totalRevenue } = useMemo(() => {
    if (!sp) return { totalCompleted: 0, totalRevenue: 0 };
    const filtered = jobs.filter((j) => {
      if (j.assignedSpId !== sp.id) return false;
      if (j.status !== "Completed") return false;
      if (!j.completedAt) return false;
      const c = new Date(j.completedAt);
      return c >= startDate && c <= endDate;
    });
    return {
      totalCompleted: filtered.length,
      totalRevenue: filtered.reduce((sum, j) => sum + (j.payoutShare ?? j.payout ?? 0), 0),
    };
  }, [jobs, sp, startDate, endDate]);

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

  const formattedRevenue = `$${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-header">Performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your performance metrics and totals</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="12mo">Last 12 months</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {timeframe === "custom" && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !customStart && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStart ? format(customStart, "MMM d, yyyy") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !customEnd && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEnd ? format(customEnd, "MMM d, yyyy") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Total Jobs Completed" value={totalCompleted} icon={<CheckCircle2 className="h-5 w-5" />} />
        <MetricCard label="Total Revenue Produced" value={formattedRevenue} icon={<DollarSign className="h-5 w-5" />} />
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
