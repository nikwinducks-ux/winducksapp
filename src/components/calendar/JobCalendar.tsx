import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import type { Job, ServiceProvider } from "@/data/mockData";
import { JobBlock } from "./JobBlock";
import { cn } from "@/lib/utils";

export type CalendarView = "day" | "week" | "month";

interface JobCalendarProps {
  jobs: Job[];
  providers: ServiceProvider[];
  view: CalendarView;
  currentDate: Date;
  onJobClick: (job: Job) => void;
  onEmptyDayClick?: (date: Date) => void;
  mode: "admin" | "sp";
}

function spNameLookup(providers: ServiceProvider[]) {
  const map = new Map(providers.map((p) => [p.id, p.name]));
  return (id?: string) => (id ? map.get(id) ?? "Unknown SP" : "Unassigned");
}

function jobsOnDate(jobs: Job[], date: Date) {
  return jobs
    .filter((j) => j.scheduledDate && isSameDay(new Date(j.scheduledDate), date))
    .sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
}

export function JobCalendar(props: JobCalendarProps) {
  if (props.view === "day") return <DayView {...props} />;
  if (props.view === "week") return <WeekView {...props} />;
  return <MonthView {...props} />;
}

// ===== Day View =====
function DayView({ jobs, providers, currentDate, onJobClick, onEmptyDayClick, mode }: JobCalendarProps) {
  const getSpName = spNameLookup(providers);
  const dayJobs = jobsOnDate(jobs, currentDate);
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <div className="text-sm font-medium">
          {format(currentDate, "EEEE, MMMM d, yyyy")}
          {isToday(currentDate) && (
            <span className="ml-2 text-xs text-primary font-semibold">Today</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{dayJobs.length} job(s)</div>
      </div>
      <div className="p-4 space-y-2 min-h-[400px]">
        {dayJobs.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            No scheduled jobs for this day.
            {mode === "admin" && onEmptyDayClick && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onEmptyDayClick(currentDate)}
                  className="text-primary hover:underline text-xs font-medium"
                >
                  + Schedule a job
                </button>
              </div>
            )}
          </div>
        ) : (
          dayJobs.map((job) => (
            <JobBlock
              key={job.dbId}
              job={job}
              spName={mode === "admin" ? getSpName(job.assignedSpId) : undefined}
              onClick={() => onJobClick(job)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ===== Week View =====
function WeekView({ jobs, providers, currentDate, onJobClick, onEmptyDayClick, mode }: JobCalendarProps) {
  const getSpName = spNameLookup(providers);
  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn(
              "px-2 py-2 text-center border-r last:border-r-0",
              isToday(d) && "bg-primary/10"
            )}
          >
            <div className="text-[10px] uppercase text-muted-foreground font-semibold">
              {format(d, "EEE")}
            </div>
            <div
              className={cn(
                "text-sm font-semibold",
                isToday(d) && "text-primary"
              )}
            >
              {format(d, "d")}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 min-h-[500px]">
        {days.map((d) => {
          const dayJobs = jobsOnDate(jobs, d);
          return (
            <div
              key={d.toISOString()}
              className="border-r last:border-r-0 p-1.5 space-y-1 align-top"
            >
              {dayJobs.length === 0 && mode === "admin" && onEmptyDayClick ? (
                <button
                  type="button"
                  onClick={() => onEmptyDayClick(d)}
                  className="w-full text-[10px] text-muted-foreground hover:text-primary hover:bg-accent/40 rounded py-2"
                >
                  + Add
                </button>
              ) : (
                dayJobs.map((job) => (
                  <JobBlock
                    key={job.dbId}
                    job={job}
                    compact
                    spName={mode === "admin" ? getSpName(job.assignedSpId) : undefined}
                    onClick={() => onJobClick(job)}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Month View =====
function MonthView({ jobs, providers, currentDate, onJobClick, onEmptyDayClick, mode }: JobCalendarProps) {
  const getSpName = spNameLookup(providers);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weekdays = useMemo(
    () => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    []
  );

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekdays.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-center text-[10px] uppercase text-muted-foreground font-semibold border-r last:border-r-0"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((d) => {
          const dayJobs = jobsOnDate(jobs, d);
          const inMonth = isSameMonth(d, currentDate);
          const visible = dayJobs.slice(0, 3);
          const overflow = dayJobs.length - visible.length;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "border-r border-b last:border-r-0 min-h-[110px] p-1 space-y-1",
                !inMonth && "bg-muted/20",
                isToday(d) && "bg-primary/5"
              )}
            >
              <div
                className={cn(
                  "text-xs font-semibold px-1",
                  !inMonth && "text-muted-foreground",
                  isToday(d) && "text-primary"
                )}
              >
                {format(d, "d")}
              </div>
              {visible.map((job) => (
                <JobBlock
                  key={job.dbId}
                  job={job}
                  compact
                  spName={mode === "admin" ? getSpName(job.assignedSpId) : undefined}
                  onClick={() => onJobClick(job)}
                />
              ))}
              {overflow > 0 && (
                <div className="text-[10px] text-muted-foreground px-1">
                  +{overflow} more
                </div>
              )}
              {dayJobs.length === 0 && inMonth && mode === "admin" && onEmptyDayClick && (
                <button
                  type="button"
                  onClick={() => onEmptyDayClick(d)}
                  className="w-full text-[10px] text-muted-foreground/60 hover:text-primary py-1"
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
