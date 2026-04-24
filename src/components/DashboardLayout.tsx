import { NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import { useOfferRealtime } from "@/hooks/useOfferRealtime";
import { NotificationsBanner } from "@/components/NotificationsBanner";
import { MobileTopNav } from "@/components/MobileTopNav";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Briefcase, Calendar, Zap, TrendingUp,
  Sliders, Scale, Users, FlaskConical, GitBranch, Plug, Tag,
  ChevronLeft, ChevronRight, Shield, UserCircle, Contact,
  LogOut, ClipboardList, Settings, TestTube, CalendarDays,
  Smartphone, Monitor,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";

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
  { to: "/admin/allocation", icon: Sliders, label: "Allocation" },
  { to: "/admin/providers", icon: Users, label: "Service Providers" },
  { to: "/admin/customers", icon: Contact, label: "Customers" },
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
}: {
  links: typeof spLinks;
  collapsed: boolean;
  isAdmin: boolean;
  user: any;
  signOut: () => void;
}) {
  const location = useLocation();
  const role = user?.role ?? "sp";
  return (
    <>
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
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Smartphone className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Install app</span>}
        </Link>
      </nav>

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
  const { mode, toggle } = useLayoutMode();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const role = user?.role ?? "sp";
  const isAdmin = role === "admin" || role === "owner";
  const links = isAdmin ? adminLinks : spLinks;
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const mobileMainRef = useRef<HTMLElement>(null);
  const desktopMainRef = useRef<HTMLElement>(null);

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

  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
  };

  const ptrEnabled = isMobile;
  const mobilePtr = usePullToRefresh(mobileMainRef, {
    enabled: ptrEnabled && mode === "mobile",
    onRefresh: handleRefresh,
  });
  const desktopPtr = usePullToRefresh(desktopMainRef, {
    enabled: ptrEnabled && mode !== "mobile",
    onRefresh: handleRefresh,
  });

  if (mode === "mobile") {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <MobileTopNav
          title={pageTitle}
          links={links}
          isAdmin={isAdmin}
          user={user}
          signOut={signOut}
        />
        {isMobile && (
          <PullToRefreshIndicator
            pullDistance={mobilePtr.pullDistance}
            isRefreshing={mobilePtr.isRefreshing}
            threshold={mobilePtr.threshold}
          />
        )}
        <main ref={mobileMainRef} className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6">
            {!isAdmin && user?.spId && <NotificationsBanner />}
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={`sticky top-0 hidden h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 sm:flex ${
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

      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-20 flex h-10 items-center justify-end gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Switch to mobile view"
            title="Switch to mobile view"
            className="h-8 w-8"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>
        <div className="mx-auto max-w-7xl p-4 sm:p-6 xl:p-8">
          {!isAdmin && user?.spId && <NotificationsBanner />}
          {children}
        </div>
      </main>
    </div>
  );
}
