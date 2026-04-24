import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LayoutModeProvider } from "@/contexts/LayoutModeContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
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
import AllocationHub from "./pages/admin/AllocationHub";
import SPManagement from "./pages/admin/SPManagement";
import SPDetail from "./pages/admin/SPDetail";
import SPForm from "./pages/admin/SPForm";
import CustomerManagement from "./pages/admin/CustomerManagement";
import CustomerDetail from "./pages/admin/CustomerDetail";
import CustomerForm from "./pages/admin/CustomerForm";
import CustomerTags from "./pages/admin/CustomerTags";
import SimulationTool from "./pages/admin/SimulationTool";
import AllocationQA from "./pages/admin/AllocationQA";
import OfferWorkflow from "./pages/admin/OfferWorkflow";
import Integrations from "./pages/admin/Integrations";
import JobManagement from "./pages/admin/JobManagement";
import JobForm from "./pages/admin/JobForm";
import JobDetail from "./pages/admin/JobDetail";
import UserManagement from "./pages/admin/UserManagement";
import ServiceCategories from "./pages/admin/ServiceCategories";
import CategoryDetail from "./pages/admin/CategoryDetail";
import LaunchReadiness from "./pages/admin/LaunchReadiness";
import OwnerSetup from "./pages/admin/OwnerSetup";
import AdminCalendar from "./pages/admin/AdminCalendar";
import SPCalendar from "./pages/sp/SPCalendar";
import ReviewSubmit from "./pages/ReviewSubmit";
import Unsubscribe from "./pages/Unsubscribe";
import Install from "./pages/Install";

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
        <Route path="/review/:token" element={<ReviewSubmit />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Block disabled users
  if (!user.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <p className="text-destructive font-semibold">Your account has been disabled.</p>
        <p className="text-sm text-muted-foreground">Contact your administrator for access.</p>
        <Button variant="outline" onClick={() => { import("@/integrations/supabase/client").then(m => m.supabase.auth.signOut()); }}>Sign Out</Button>
      </div>
    );
  }

  const role = user.role;
  const isAdmin = role === "admin" || role === "owner";

  return (
    <DashboardLayout>
      <Routes>
        {/* Public routes (also accessible while logged in) */}
        <Route path="/review/:token" element={<ReviewSubmit />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/install" element={<Install />} />

        {/* SP Routes — only accessible to SP role */}
        <Route path="/" element={!isAdmin ? <SPDashboard /> : <Navigate to="/admin" replace />} />
        <Route path="/jobs" element={!isAdmin ? <JobOffers /> : <Navigate to="/admin" replace />} />
        <Route path="/jobs/:id" element={!isAdmin ? <JobOfferDetail /> : <Navigate to="/admin" replace />} />
        <Route path="/availability" element={!isAdmin ? <AvailabilitySettings /> : <Navigate to="/admin" replace />} />
        <Route path="/auto-accept" element={!isAdmin ? <AutoAcceptSettings /> : <Navigate to="/admin" replace />} />
        <Route path="/performance" element={!isAdmin ? <PerformancePage /> : <Navigate to="/admin" replace />} />
        <Route path="/my-jobs" element={!isAdmin ? <MyJobs /> : <Navigate to="/admin" replace />} />
        <Route path="/sp/jobs/:id" element={!isAdmin ? <SPJobDetail /> : <Navigate to="/admin" replace />} />
        <Route path="/account" element={!isAdmin ? <AccountPage /> : <Navigate to="/admin" replace />} />
        <Route path="/calendar" element={!isAdmin ? <SPCalendar /> : <Navigate to="/admin" replace />} />

        {/* Admin Routes — accessible to admin and owner roles */}
        <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/" replace />} />
        <Route path="/admin/allocation" element={isAdmin ? <AllocationControl /> : <Navigate to="/" replace />} />
        <Route path="/admin/fairness" element={isAdmin ? <FairnessControls /> : <Navigate to="/" replace />} />
        <Route path="/admin/providers" element={isAdmin ? <SPManagement /> : <Navigate to="/" replace />} />
        <Route path="/admin/providers/new" element={isAdmin ? <SPForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/providers/:id" element={isAdmin ? <SPDetail /> : <Navigate to="/" replace />} />
        <Route path="/admin/providers/:id/edit" element={isAdmin ? <SPForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/customers" element={isAdmin ? <CustomerManagement /> : <Navigate to="/" replace />} />
        <Route path="/admin/customers/tags" element={isAdmin ? <CustomerTags /> : <Navigate to="/" replace />} />
        <Route path="/admin/customers/new" element={isAdmin ? <CustomerForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/customers/:id" element={isAdmin ? <CustomerDetail /> : <Navigate to="/" replace />} />
        <Route path="/admin/customers/:id/edit" element={isAdmin ? <CustomerForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/jobs" element={isAdmin ? <JobManagement /> : <Navigate to="/" replace />} />
        <Route path="/admin/jobs/new" element={isAdmin ? <JobForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/jobs/:id" element={isAdmin ? <JobDetail /> : <Navigate to="/" replace />} />
        <Route path="/admin/jobs/:id/edit" element={isAdmin ? <JobForm /> : <Navigate to="/" replace />} />
        <Route path="/admin/simulation" element={isAdmin ? <SimulationTool /> : <Navigate to="/" replace />} />
        <Route path="/admin/qa" element={isAdmin ? <AllocationQA /> : <Navigate to="/" replace />} />
        <Route path="/admin/workflow" element={isAdmin ? <OfferWorkflow /> : <Navigate to="/" replace />} />
        <Route path="/admin/integrations" element={isAdmin ? <Integrations /> : <Navigate to="/" replace />} />
        <Route path="/admin/users" element={isAdmin ? <UserManagement /> : <Navigate to="/" replace />} />
        <Route path="/admin/categories" element={isAdmin ? <ServiceCategories /> : <Navigate to="/" replace />} />
        <Route path="/admin/categories/:id" element={isAdmin ? <CategoryDetail /> : <Navigate to="/" replace />} />
        <Route path="/admin/readiness" element={isAdmin ? <LaunchReadiness /> : <Navigate to="/" replace />} />
        <Route path="/admin/owner-setup" element={isAdmin ? <OwnerSetup /> : <Navigate to="/" replace />} />
        <Route path="/admin/calendar" element={isAdmin ? <AdminCalendar /> : <Navigate to="/" replace />} />

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
          <LayoutModeProvider>
            <AppRoutes />
          </LayoutModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
