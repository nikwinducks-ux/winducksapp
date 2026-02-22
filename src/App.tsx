import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useSeedData } from "@/hooks/useSupabaseData";
import NotFound from "./pages/NotFound";

// SP Pages
import SPDashboard from "./pages/sp/SPDashboard";
import JobOffers from "./pages/sp/JobOffers";
import JobOfferDetail from "./pages/sp/JobOfferDetail";
import AvailabilitySettings from "./pages/sp/AvailabilitySettings";
import AutoAcceptSettings from "./pages/sp/AutoAcceptSettings";
import PerformancePage from "./pages/sp/PerformancePage";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AllocationControl from "./pages/admin/AllocationControl";
import FairnessControls from "./pages/admin/FairnessControls";
import SPManagement from "./pages/admin/SPManagement";
import SPDetail from "./pages/admin/SPDetail";
import SPForm from "./pages/admin/SPForm";
import CustomerManagement from "./pages/admin/CustomerManagement";
import CustomerDetail from "./pages/admin/CustomerDetail";
import CustomerForm from "./pages/admin/CustomerForm";
import SimulationTool from "./pages/admin/SimulationTool";
import OfferWorkflow from "./pages/admin/OfferWorkflow";
import Integrations from "./pages/admin/Integrations";

const queryClient = new QueryClient();

function AppRoutes() {
  const { role } = useRole();
  useSeedData();

  return (
    <DashboardLayout>
      <Routes>
        {/* SP Routes */}
        <Route path="/" element={role === "sp" ? <SPDashboard /> : <Navigate to="/admin" replace />} />
        <Route path="/jobs" element={<JobOffers />} />
        <Route path="/jobs/:id" element={<JobOfferDetail />} />
        <Route path="/availability" element={<AvailabilitySettings />} />
        <Route path="/auto-accept" element={<AutoAcceptSettings />} />
        <Route path="/performance" element={<PerformancePage />} />

        {/* Admin Routes */}
        <Route path="/admin" element={role === "admin" ? <AdminDashboard /> : <Navigate to="/" replace />} />
        <Route path="/admin/allocation" element={<AllocationControl />} />
        <Route path="/admin/fairness" element={<FairnessControls />} />
        <Route path="/admin/providers" element={<SPManagement />} />
        <Route path="/admin/providers/new" element={<SPForm />} />
        <Route path="/admin/providers/:id" element={<SPDetail />} />
        <Route path="/admin/providers/:id/edit" element={<SPForm />} />
        <Route path="/admin/customers" element={<CustomerManagement />} />
        <Route path="/admin/customers/new" element={<CustomerForm />} />
        <Route path="/admin/customers/:id" element={<CustomerDetail />} />
        <Route path="/admin/customers/:id/edit" element={<CustomerForm />} />
        <Route path="/admin/simulation" element={<SimulationTool />} />
        <Route path="/admin/workflow" element={<OfferWorkflow />} />
        <Route path="/admin/integrations" element={<Integrations />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RoleProvider>
          <AppRoutes />
        </RoleProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
