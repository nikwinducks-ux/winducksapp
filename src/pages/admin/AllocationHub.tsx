import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AllocationControl from "./AllocationControl";
import FairnessControls from "./FairnessControls";
import SimulationTool from "./SimulationTool";
import AllocationQA from "./AllocationQA";

const VALID_TABS = ["control", "fairness", "simulation", "qa"] as const;
type TabKey = (typeof VALID_TABS)[number];

export default function AllocationHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const active: TabKey = (VALID_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as TabKey)
    : "control";

  const handleChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Allocation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure scoring, fairness, simulate runs, and QA the allocation engine
        </p>
      </div>

      <Tabs value={active} onValueChange={handleChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="control">Control</TabsTrigger>
          <TabsTrigger value="fairness">Fairness</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="qa">QA</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="mt-0">
          <AllocationControl />
        </TabsContent>
        <TabsContent value="fairness" className="mt-0">
          <FairnessControls />
        </TabsContent>
        <TabsContent value="simulation" className="mt-0">
          <SimulationTool />
        </TabsContent>
        <TabsContent value="qa" className="mt-0">
          <AllocationQA />
        </TabsContent>
      </Tabs>
    </div>
  );
}
