import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { useServiceProviders, useJobs } from "@/hooks/useSupabaseData";
import {
  useActivePolicy,
  useFairnessContext,
  useSaveAllocationRun,
} from "@/hooks/useAllocationData";
import {
  useOffers,
  useGenerateOffers,
  useCancelOffers,
  useExpireStaleOffers,
} from "@/hooks/useOfferData";
import { runAllocation, explainTopCandidate, type CandidateResult, type AllocationWeights } from "@/lib/allocation-engine";
import { useAuth } from "@/contexts/AuthContext";
import { ScoreBar } from "@/components/ScoreBar";
import {
  FlaskConical, Trophy, Info, GitCompare, AlertTriangle, CheckCircle,
  XCircle, Send, Ban, RefreshCw, Clock,
} from "lucide-react";

export default function AllocationQA() {
  const { user } = useAuth();
  const { data: serviceProviders = [] } = useServiceProviders();
  const { data: jobs = [] } = useJobs();
  const activePolicy = useActivePolicy();
  const { data: fairnessCtx } = useFairnessContext(activePolicy?.fairness_json?.rollingWindow ?? 30);
  const saveRun = useSaveAllocationRun();
  const generateOffers = useGenerateOffers();
  const cancelOffers = useCancelOffers();
  const expireStale = useExpireStaleOffers();

  const [selectedJob, setSelectedJob] = useState("");
  const [results, setResults] = useState<CandidateResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [runSaved, setRunSaved] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [topN, setTopN] = useState(3);
  const [expiryMinutes, setExpiryMinutes] = useState(10);

  // Diff mode
  const [diffFactor, setDiffFactor] = useState<keyof AllocationWeights>("proximity");
  const [diffValue, setDiffValue] = useState(30);
  const [diffResults, setDiffResults] = useState<CandidateResult[] | null>(null);

  const job = jobs.find((j) => j.dbId === selectedJob);
  const { data: jobOffers = [], refetch: refetchOffers } = useOffers(selectedJob || undefined);

  // Expire stale offers on load
  useEffect(() => {
    expireStale.mutate();
  }, []);

  // Auto-refresh offers
  useEffect(() => {
    if (!selectedJob) return;
    const iv = setInterval(() => {
      refetchOffers();
      expireStale.mutate();
    }, 5000);
    return () => clearInterval(iv);
  }, [selectedJob]);

  const handleRun = async () => {
    if (!activePolicy || !fairnessCtx || !job) return;
    setRunning(true);
    setRunSaved(false);
    setDiffResults(null);
    setLastRunId(null);

    const candidates = runAllocation(job, serviceProviders, activePolicy.weights_json, activePolicy.fairness_json, fairnessCtx);
    setResults(candidates);

    try {
      const runId = await saveRun.mutateAsync({
        jobId: job.dbId,
        policyId: activePolicy.id,
        selectedSpId: candidates.find((c) => c.rank === 1)?.sp.id ?? null,
        candidates,
        userId: user?.id,
        label: `QA Run — ${activePolicy.version_name}`,
      });
      setRunSaved(true);
      setLastRunId(runId);
    } catch (err) {
      console.error("Failed to save run:", err);
    }

    setRunning(false);
  };

  const handleGenerateOffers = async () => {
    if (!results || !lastRunId || !job) return;
    const eligible = results.filter(c => c.eligibilityStatus === "Eligible");
    const topSpIds = eligible.slice(0, topN).map(c => c.sp.id);
    if (topSpIds.length === 0) return;

    await generateOffers.mutateAsync({
      jobId: job.dbId,
      allocationRunId: lastRunId,
      topSpIds,
      serviceProviders,
      job,
      expiryMinutes,
      createdBy: user?.id ?? "system",
    });
    refetchOffers();
  };

  const handleCancelOffers = async () => {
    if (!selectedJob) return;
    await cancelOffers.mutateAsync(selectedJob);
    refetchOffers();
  };

  const handleDiffRun = async () => {
    if (!activePolicy || !fairnessCtx || !job) return;
    const modifiedWeights = { ...activePolicy.weights_json, [diffFactor]: diffValue };
    const candidates = runAllocation(job, serviceProviders, modifiedWeights, activePolicy.fairness_json, fairnessCtx);
    setDiffResults(candidates);

    try {
      await saveRun.mutateAsync({
        jobId: job.dbId,
        policyId: activePolicy.id,
        selectedSpId: candidates.find((c) => c.rank === 1)?.sp.id ?? null,
        candidates,
        userId: user?.id,
        label: `QA Diff — ${diffFactor}=${diffValue}`,
      });
    } catch (err) {
      console.error("Failed to save diff run:", err);
    }
  };

  const factorKeys: (keyof AllocationWeights)[] = [
    "availability", "proximity", "competency", "jobHistory",
    "customerRating", "reliability", "responsiveness", "safetyCompliance", "fairness",
  ];

  const pendingOffers = jobOffers.filter(o => o.status === "Pending");
  const hasActiveOffers = pendingOffers.length > 0;
  const jobAssigned = job?.assignedSpId;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">Allocation QA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Run allocation • Generate offers • Monitor acceptance
        </p>
      </div>

      {/* Active policy info */}
      {activePolicy && (
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Active Policy</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{activePolicy.version_name}</p>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(activePolicy.created_at).toLocaleDateString()}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(activePolicy.weights_json).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs">
                <span className="text-muted-foreground">{k}:</span>
                <span className="font-semibold">{v as number}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Job selector */}
      <div className="metric-card space-y-4">
        <h2 className="section-title">Select Job</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <Select value={selectedJob} onValueChange={(v) => { setSelectedJob(v); setResults(null); setDiffResults(null); setLastRunId(null); }}>
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Select a job to test" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.dbId} value={j.dbId}>
                  {j.id} — {j.customerName} ({j.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleRun} disabled={!selectedJob || running || !activePolicy || !!jobAssigned}>
            <FlaskConical className="h-4 w-4 mr-2" />
            {running ? "Running…" : "Run Allocation"}
          </Button>
          {runSaved && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="h-3.5 w-3.5" /> Run saved
            </span>
          )}
        </div>
        {jobAssigned && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-success" /> This job is already assigned.
          </p>
        )}
      </div>

      {/* Offer Controls */}
      {results && results.length > 0 && !jobAssigned && (
        <div className="metric-card space-y-4">
          <h2 className="section-title">Generate Offers</h2>
          <div className="flex gap-4 flex-wrap items-end">
            <div className="space-y-1">
              <Label className="text-sm">Top N SPs</Label>
              <Input type="number" min={1} max={10} value={topN} onChange={e => setTopN(parseInt(e.target.value) || 3)} className="w-20" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Expiry (min)</Label>
              <Input type="number" min={1} max={60} value={expiryMinutes} onChange={e => setExpiryMinutes(parseInt(e.target.value) || 10)} className="w-20" />
            </div>
            <Button
              onClick={handleGenerateOffers}
              disabled={!lastRunId || generateOffers.isPending || hasActiveOffers}
            >
              <Send className="h-4 w-4 mr-2" />
              {generateOffers.isPending ? "Sending…" : "Generate Offers"}
            </Button>
            {hasActiveOffers && (
              <>
                <Button variant="outline" onClick={handleCancelOffers} disabled={cancelOffers.isPending}>
                  <Ban className="h-4 w-4 mr-2" />
                  Cancel Offers
                </Button>
                <Button variant="outline" onClick={() => { setResults(null); setLastRunId(null); }}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-run Allocation
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Offer Monitor */}
      {jobOffers.length > 0 && (
        <div className="metric-card space-y-4">
          <h2 className="section-title">Offer Status Monitor</h2>
          <div className="space-y-2">
            {jobOffers.map(offer => {
              const sp = serviceProviders.find(s => s.id === offer.sp_id);
              const variant = offer.status === "Accepted" ? "valid"
                : offer.status === "Pending" ? "info"
                : offer.status === "Declined" ? "warning"
                : offer.status === "Expired" ? "warning"
                : "error";
              const isExpired = offer.status === "Pending" && new Date(offer.expires_at) < new Date();
              const timeLeft = offer.status === "Pending" && !isExpired
                ? Math.max(0, Math.round((new Date(offer.expires_at).getTime() - Date.now()) / 60000))
                : null;

              return (
                <div key={offer.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{sp?.name ?? offer.sp_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {offer.acceptance_source === "AutoAccept" && "⚡ Auto-accepted • "}
                      Offered {new Date(offer.offered_at).toLocaleTimeString()}
                      {offer.decline_reason && ` • Reason: ${offer.decline_reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {timeLeft !== null && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {timeLeft}m left
                      </span>
                    )}
                    <StatusBadge label={isExpired ? "Expired" : offer.status} variant={isExpired ? "warning" : variant} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <>
          {results[0].eligibilityStatus === "Eligible" && (
            <div className="metric-card border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-primary" />
                <h2 className="section-title">Why {results[0].sp.name} ranked #1</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {explainTopCandidate(results[0], activePolicy!.weights_json)}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {results.map((item) => (
              <CandidateCard key={item.sp.id} item={item} />
            ))}
          </div>

          {/* Diff mode */}
          <div className="metric-card space-y-4">
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-muted-foreground" />
              <h2 className="section-title">Policy Diff</h2>
            </div>
            <div className="flex gap-4 flex-wrap items-end">
              <div className="space-y-2">
                <Label className="text-sm">Factor</Label>
                <Select value={diffFactor} onValueChange={(v) => setDiffFactor(v as keyof AllocationWeights)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {factorKeys.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-48">
                <Label className="text-sm">New weight: {diffValue}</Label>
                <Slider value={[diffValue]} onValueChange={(v) => setDiffValue(v[0])} max={100} step={1} />
              </div>
              <Button variant="outline" onClick={handleDiffRun}>
                <GitCompare className="h-4 w-4 mr-2" /> Run Diff
              </Button>
            </div>

            {diffResults && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">
                  Diff: {diffFactor} = {diffValue} (was {(activePolicy?.weights_json as any)?.[diffFactor]})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3">SP</th>
                        <th className="py-2 pr-3">Orig Rank</th>
                        <th className="py-2 pr-3">Orig Score</th>
                        <th className="py-2 pr-3">New Rank</th>
                        <th className="py-2 pr-3">New Score</th>
                        <th className="py-2 pr-3">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffResults.filter((d) => d.eligibilityStatus === "Eligible").map((diff) => {
                        const orig = results.find((r) => r.sp.id === diff.sp.id);
                        const scoreDelta = diff.finalScore - (orig?.finalScore ?? 0);
                        const rankDelta = (orig?.rank ?? 0) - diff.rank;
                        return (
                          <tr key={diff.sp.id} className="border-b">
                            <td className="py-2 pr-3 font-medium">{diff.sp.name}</td>
                            <td className="py-2 pr-3">#{orig?.rank ?? "—"}</td>
                            <td className="py-2 pr-3">{orig?.finalScore ?? "—"}</td>
                            <td className="py-2 pr-3">#{diff.rank}</td>
                            <td className="py-2 pr-3">{diff.finalScore}</td>
                            <td className={`py-2 pr-3 font-semibold ${scoreDelta > 0 ? "text-success" : scoreDelta < 0 ? "text-destructive" : ""}`}>
                              {scoreDelta > 0 ? "+" : ""}{scoreDelta.toFixed(1)}
                              {rankDelta !== 0 && (
                                <span className="text-xs ml-1">
                                  ({rankDelta > 0 ? `↑${rankDelta}` : `↓${Math.abs(rankDelta)}`})
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CandidateCard({ item }: { item: CandidateResult }) {
  const isExcluded = item.eligibilityStatus === "Excluded";

  return (
    <div className={`metric-card ${item.rank === 1 ? "border-primary/30" : ""} ${isExcluded ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-4">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isExcluded
            ? "bg-destructive/10 text-destructive"
            : item.rank === 1
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
        }`}>
          {isExcluded ? <XCircle className="h-4 w-4" /> : `#${item.rank}`}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <p className="font-semibold">{item.sp.name}</p>
            <span className="text-xs text-muted-foreground">{item.sp.baseAddress.city}</span>
            {item.distKm !== null && (
              <span className={`text-xs ${item.distKm > 100 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {item.distKm} km
              </span>
            )}
            {item.sp.autoAccept && <StatusBadge label="Auto-Accept" variant="info" />}
            {!isExcluded && <span className="text-xl font-bold text-primary">{item.finalScore}</span>}
            {isExcluded && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" /> {item.exclusionReason}
              </span>
            )}
          </div>
          {!isExcluded && (
            <div className="grid gap-2 sm:grid-cols-4">
              <ScoreBar label="Availability" value={item.factorScores.availability} />
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Proximity</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 score-bar-track"><div className="score-bar" style={{ width: `${item.factorScores.proximity}%` }} /></div>
                  <span className="text-xs font-semibold w-8 text-right">{item.factorScores.proximity}%</span>
                </div>
                {item.distKm !== null && <p className="text-xs text-muted-foreground">{item.distKm} km</p>}
              </div>
              <ScoreBar label="Competency" value={item.factorScores.competency} />
              <ScoreBar label="Reliability" value={item.factorScores.reliability} />
              <ScoreBar label="Rating" value={item.factorScores.customerRating} />
              <ScoreBar label="Job History" value={item.factorScores.jobHistory} />
              <ScoreBar label="Responsiveness" value={item.factorScores.responsiveness} />
              <ScoreBar label="Safety" value={item.factorScores.safetyCompliance} />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fairness Adj.</span>
                  <span className={`font-medium ${item.fairnessAdjustment >= 0 ? "text-success" : "text-destructive"}`}>
                    {item.fairnessAdjustment >= 0 ? "+" : ""}{item.fairnessAdjustment}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Weighted Base</span>
                  <span className="font-medium">{item.weightedScore}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
