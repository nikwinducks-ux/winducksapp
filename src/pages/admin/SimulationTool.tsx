import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jobs, serviceProviders } from "@/data/mockData";
import { ScoreBar } from "@/components/ScoreBar";
import { FlaskConical, Trophy } from "lucide-react";

function generateScores() {
  return serviceProviders
    .filter((sp) => sp.complianceStatus !== "Suspended")
    .map((sp) => ({
      sp,
      scores: {
        availability: Math.round(60 + Math.random() * 40),
        proximity: Math.round(30 + Math.random() * 70),
        competency: Math.round(70 + Math.random() * 30),
        reliability: sp.reliabilityScore,
        rating: Math.round(sp.rating * 20),
        fairness: Math.round(Math.random() * 15 - 5),
        final: 0,
      },
    }))
    .map((item) => {
      item.scores.final = Math.round(
        (item.scores.availability * 0.2 +
          item.scores.proximity * 0.15 +
          item.scores.competency * 0.15 +
          item.scores.reliability * 0.1 +
          item.scores.rating * 0.15 +
          item.scores.fairness * 0.05 + 50) /
          1
      );
      return item;
    })
    .sort((a, b) => b.scores.final - a.scores.final);
}

export default function SimulationTool() {
  const [selectedJob, setSelectedJob] = useState("");
  const [results, setResults] = useState<ReturnType<typeof generateScores> | null>(null);
  const [running, setRunning] = useState(false);

  const runSimulation = () => {
    setRunning(true);
    setTimeout(() => {
      setResults(generateScores());
      setRunning(false);
    }, 800);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">Allocation Simulation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Test allocation scoring against mock jobs</p>
      </div>

      <div className="metric-card space-y-4">
        <h2 className="section-title">Select Job</h2>
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Select a job to simulate" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.id} — {job.customerName} ({job.serviceCategory})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={runSimulation} disabled={!selectedJob || running}>
            <FlaskConical className="h-4 w-4 mr-2" />
            {running ? "Running..." : "Run Allocation"}
          </Button>
        </div>
      </div>

      {results && (
        <>
          {/* #1 Explanation */}
          <div className="metric-card border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="section-title">Why {results[0].sp.name} ranked #1</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {results[0].sp.name} scored highest with a final allocation score of {results[0].scores.final}.
              Key strengths: availability fit ({results[0].scores.availability}%), reliability ({results[0].scores.reliability}%),
              and rating ({results[0].scores.rating}%).
              {results[0].scores.fairness > 0 && ` Additionally received a +${results[0].scores.fairness} fairness boost.`}
            </p>
          </div>

          {/* Rankings */}
          <div className="space-y-3">
            {results.map((item, idx) => (
              <div key={item.sp.id} className={`metric-card ${idx === 0 ? "border-primary/30" : ""}`}>
                <div className="flex items-center gap-4">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    idx === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <p className="font-semibold">{item.sp.name}</p>
                      <span className="text-xl font-bold text-primary">{item.scores.final}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <ScoreBar label="Availability" value={item.scores.availability} />
                      <ScoreBar label="Proximity" value={item.scores.proximity} />
                      <ScoreBar label="Competency" value={item.scores.competency} />
                      <ScoreBar label="Reliability" value={item.scores.reliability} />
                      <ScoreBar label="Rating" value={item.scores.rating} />
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Fairness Adj.</span>
                          <span className={`font-medium ${item.scores.fairness >= 0 ? "text-success" : "text-destructive"}`}>
                            {item.scores.fairness >= 0 ? "+" : ""}{item.scores.fairness}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
