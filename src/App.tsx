import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useSeedData } from "@/hooks/useSupabaseData";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
// Signup removed — accounts are admin-created only

// SP Pages
import SPDashboard from "./pages/sp/SPDashboard";
import JobOffers from "./pages/sp/JobOffers";
import JobOfferDetail from "./pages/sp/JobOfferDetail";
import AvailabilitySettings from "./pages/sp/AvailabilitySettings";
import AutoAcceptSettings from "./pages/sp/AutoAcceptSettings";
import PerformancePage from "./pages/sp/PerformancePage";
import MyJobs from "./pages/sp/MyJobs";
import SPJobDetail from "./pages/sp/SPJobDetail";
import AccountPage from "./pages/sp/AccountPage";

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
import AllocationQA from "./pages/admin/AllocationQA";
import OfferWorkflow from "./pages/admin/OfferWorkflow";
import Integrations from "./pages/admin/Integrations";
import JobManagement from "./pages/admin/JobManagement";
import JobForm from "./pages/admin/JobForm";
import JobDetail from "./pages/admin/JobDetail";
import UserManagement from "./pages/admin/UserManagement";
import ServiceCategories from "./pages/admin/ServiceCategories";
import LaunchReadiness from "./pages/admin/LaunchReadiness";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function AppRoutes() {
  const { user, loading } = useAuth();
  useSeedData();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const role = user.role;

  return (
    <DashboardLayout>
      <Routes>
        {/* SP Routes — only accessible to SP role */}
        <Route path="/" element={role === "sp" ? <SPDashboard /> : <Navigate to="/admin" replace />} />
        <Route path="/jobs" element={role === "sp" ? <JobOffers /> : <Navigate to="/admin" replace />} />
        <Route path="/jobs/:id" element={role === "sp" ? <JobOfferDetail /> : <Navigate to="/admin" replace />} />
        <Route path="/availability" element={role === "sp" ? <AvailabilitySettings /> : <Navigate to="/admin" replace />} />
        <Route path="/auto-accept" element={role === "sp" ? <AutoAcceptSettings /> : <Navigate to="/admin" replace />} />
        <Route path="/performance" element={role === "sp" ? <PerformancePage /> : <Navigate to="/admin" replace />} />
        <Route path="/my-jobs" element={role === "sp" ? <MyJobs /> : <Navigate to="/admin" replace />} />
        <Route path="/sp/jobs/:id" element={role === "sp" ? <SPJobDetail /> : <Navigate to="/admin" replace />} />
        <Route path="/account" element={role === "sp" ? <AccountPage /> : <Navigate to="/admin" replace />} />

        {/* Admin Routes — only accessible to admin role */}
        <Route path="/admin" element={role === "admin" ? <AdminDashboard /> : <Navigate to="/" replace />} />
        <Route path="/admin/allocation" element={role === "admin" ? <AllocationControl /> : <Navigate to="/" replace />} />
        <Route path="/admin/fairness" element={role === "admin" ? <FairnessControls /> : <Navigate to="/" replace />} />
        <Route path="/admin/providers" element={role === "admin" ? <SPManagement /> : <Navigate to="/" replace />} />
        <Route path="/admin/providers/new" element={role === "admin" ? <SPForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/providers/:id" element={role === "admin" ? <SPDetail /> : <Navigate to="/" replace />} />
        <Route path="/admin/providers/:id/edit" element={role === "admin" ? <SPForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/customers" element={role === "admin" ? <CustomerManagement /> : <Navigate to="/" replace />} />
        <Route path="/admin/customers/new" element={role === "admin" ? <CustomerForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/customers/:id" element={role === "admin" ? <CustomerDetail /> : <Navigate to="/" replace />} />
        <Route path="/admin/customers/:id/edit" element={role === "admin" ? <CustomerForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/jobs" element={role === "admin" ? <JobManagement /> : <Navigate to="/" replace />} />
        <Route path="/admin/jobs/new" element={role === "admin" ? <JobForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/jobs/:id" element={role === "admin" ? <JobDetail /> : <Navigate to="/" replace />} />
        <Route path="/admin/jobs/:id/edit" element={role === "admin" ? <JobForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/simulation" element={role === "admin" ? <SimulationTool /> : <Navigate to="/" replace />} />
        <Route path="/admin/qa" element={role === "admin" ? <AllocationQA /> : <Navigate to="/" replace />} />
        <Route path="/admin/workflow" element={role === "admin" ? <OfferWorkflow /> : <Navigate to="/" replace />} />
        <Route path="/admin/integrations" element={role === "admin" ? <Integrations /> : <Navigate to="/" replace />} />
        <Route path="/admin/users" element={role === "admin" ? <UserManagement /> : <Navigate to="/" replace />} />
        <Route path="/admin/categories" element={role === "admin" ? <ServiceCategories /> : <Navigate to="/" replace />} />
        <Route path="/admin/readiness" element={role === "admin" ? <LaunchReadiness /> : <Navigate to="/" replace />} />

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
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
