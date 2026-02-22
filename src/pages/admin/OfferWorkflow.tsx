import { CheckCircle, Clock, Send, UserCheck, AlertTriangle, ArrowRight } from "lucide-react";

const steps = [
  { label: "Job Created", icon: CheckCircle, status: "completed" as const, desc: "New job entered into system" },
  { label: "Allocation Run", icon: Send, status: "completed" as const, desc: "Scoring algorithm executed, candidates ranked" },
  { label: "Offer Sent", icon: Clock, status: "active" as const, desc: "Top-ranked SP receives job offer" },
  { label: "Accepted", icon: UserCheck, status: "pending" as const, desc: "SP accepts the offer" },
  { label: "Assigned", icon: CheckCircle, status: "pending" as const, desc: "Job is confirmed and scheduled" },
];

const failPath = [
  { label: "Offer Expired", icon: AlertTriangle, desc: "SP did not respond within time limit" },
  { label: "Next Candidate", icon: ArrowRight, desc: "Offer sent to next ranked SP" },
];

export default function OfferWorkflow() {
  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <div>
        <h1 className="page-header">Offer Workflow</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visual model of the job offer lifecycle</p>
      </div>

      {/* Main Flow */}
      <div className="metric-card">
        <h2 className="section-title mb-6">Happy Path</h2>
        <div className="space-y-0">
          {steps.map((step, idx) => (
            <div key={step.label} className="flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  step.status === "completed" ? "bg-success text-success-foreground" :
                  step.status === "active" ? "bg-primary text-primary-foreground animate-pulse" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  <step.icon className="h-5 w-5" />
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-0.5 h-12 ${
                    step.status === "completed" ? "bg-success" : "bg-border"
                  }`} />
                )}
              </div>
              {/* Content */}
              <div className="pb-12">
                <p className={`font-semibold ${step.status === "pending" ? "text-muted-foreground" : ""}`}>{step.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Failure Path */}
      <div className="metric-card border-warning/20">
        <h2 className="section-title mb-6">No Acceptance Path</h2>
        <p className="text-sm text-muted-foreground mb-6">When the current SP does not accept within the time limit:</p>
        <div className="space-y-0">
          {failPath.map((step, idx) => (
            <div key={step.label} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                  <step.icon className="h-5 w-5" />
                </div>
                {idx < failPath.length - 1 && <div className="w-0.5 h-12 bg-warning/30" />}
              </div>
              <div className="pb-12">
                <p className="font-semibold">{step.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="font-semibold text-primary">Back to "Offer Sent"</p>
              <p className="text-sm text-muted-foreground mt-0.5">Cycle repeats until a candidate accepts or all exhausted</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
