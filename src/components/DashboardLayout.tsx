import { NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOfferRealtime } from "@/hooks/useOfferRealtime";
import { NotificationsBanner } from "@/components/NotificationsBanner";
import { MobileTopBar } from "@/components/MobileTopBar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  LayoutDashboard, Briefcase, Calendar, Zap, TrendingUp,
  Sliders, Scale, Users, FlaskConical, GitBranch, Plug, Tag,
  ChevronLeft, ChevronRight, Shield, UserCircle, Contact,
  LogOut, ClipboardList, Settings, TestTube, CalendarDays,
  Smartphone,
} from "lucide-react";
import { useMemo, useState } from "react";

const spLinks = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/my-jobs", icon: ClipboardList, label: "My Jobs" },
  { to: "/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/jobs", icon: Briefcase, label: "Job Offers" },
  { to: "/performance", icon: TrendingUp, label: "Performance" },
  { to: "/account", icon: Settings, label: "Account" },
];

const adminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/jobs", icon: Briefcase, label: "Jobs" },
  { to: "/admin/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/admin/categories", icon: Tag, label: "Service Categories" },
  { to: "/admin/allocation", icon: Sliders, label: "Allocation Control" },
  { to: "/admin/fairness", icon: Scale, label: "Fairness Controls" },
  { to: "/admin/providers", icon: Users, label: "Service Providers" },
  { to: "/admin/customers", icon: Contact, label: "Customers" },
  { to: "/admin/simulation", icon: FlaskConical, label: "Simulation" },
  { to: "/admin/qa", icon: TestTube, label: "Allocation QA" },
  { to: "/admin/workflow", icon: GitBranch, label: "Offer Workflow" },
  { to: "/admin/integrations", icon: Plug, label: "Integrations" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/readiness", icon: Shield, label: "Launch Readiness" },
];

function SidebarBody({
  links,
  collapsed,
  isAdmin,
  user,
  signOut,
  onNavigate,
}: {
  links: typeof spLinks;
  collapsed: boolean;
  isAdmin: boolean;
  user: any;
  signOut: () => void;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const role = user?.role ?? "sp";
  return (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <img
          src="/assets/branding/winducks-iconw.png"
          alt="Winducks logo"
          className="h-10 w-10 rounded-xl object-contain"
        />
        {!collapsed && (
          <span className="font-semibold tracking-tight text-sidebar-primary-foreground">
            Winducks
          </span>
        )}
      </div>

      {/* User info */}
      <div className="border-b border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-accent-foreground text-xs font-bold bg-accent">
            {isAdmin ? <Shield className="h-3.5 w-3.5" /> : <UserCircle className="h-3.5 w-3.5" />}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.email}</p>
              <p className="text-[10px] text-sidebar-foreground/60 uppercase">{role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {links.map((link) => {
          const isActive =
            link.to === "/" || link.to === "/admin"
              ? location.pathname === link.to
              : location.pathname.startsWith(link.to);
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </NavLink>
          );
        })}

        <Link
          to="/install"
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Smartphone className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Install app</span>}
        </Link>
      </nav>

      {/* Logout */}
      <button
        onClick={signOut}
        className="flex items-center gap-2 px-4 py-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors border-t border-sidebar-border"
      >
        <LogOut className="h-3.5 w-3.5" />
        {!collapsed && "Logout"}
      </button>
    </>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const role = user?.role ?? "sp";
  const isAdmin = role === "admin" || role === "owner";
  const links = isAdmin ? adminLinks : spLinks;

  // Realtime offer notifications for SPs
  useOfferRealtime(!isAdmin ? user?.spId ?? null : null);

  const pageTitle = useMemo(() => {
    const all = [...spLinks, ...adminLinks];
    const match = all.find((l) =>
      l.to === "/" || l.to === "/admin"
        ? location.pathname === l.to
        : location.pathname.startsWith(l.to),
    );
    return match?.label ?? "Winducks";
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 lg:flex ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <SidebarBody
          links={links}
          collapsed={collapsed}
          isAdmin={isAdmin}
          user={user}
          signOut={signOut}
        />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-10 items-center justify-center border-t border-sidebar-border text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Mobile drawer sidebar */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border"
        >
          <div className="flex h-full flex-col">
            <SidebarBody
              links={links}
              collapsed={false}
              isAdmin={isAdmin}
              user={user}
              signOut={() => {
                setDrawerOpen(false);
                signOut();
              }}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <MobileTopBar title={pageTitle} onOpenMenu={() => setDrawerOpen(true)} />
        <div className="mx-auto max-w-7xl p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          {!isAdmin && user?.spId && <NotificationsBanner />}
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <MobileBottomNav isAdmin={isAdmin} />
    </div>
  );
}
