import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Briefcase, Calendar, Zap, TrendingUp,
  Sliders, Scale, Users, FlaskConical, GitBranch, Plug,
  ChevronLeft, ChevronRight, Shield, UserCircle, Contact,
  LogOut, ClipboardList, UserCog, Settings,
} from "lucide-react";
import { useState } from "react";

const spLinks = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/my-jobs", icon: ClipboardList, label: "My Jobs" },
  { to: "/jobs", icon: Briefcase, label: "Job Offers" },
  { to: "/availability", icon: Calendar, label: "Availability" },
  { to: "/auto-accept", icon: Zap, label: "Auto-Accept" },
  { to: "/performance", icon: TrendingUp, label: "Performance" },
  { to: "/account", icon: Settings, label: "Account" },
];

const adminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/jobs", icon: Briefcase, label: "Jobs" },
  { to: "/admin/allocation", icon: Sliders, label: "Allocation Control" },
  { to: "/admin/fairness", icon: Scale, label: "Fairness Controls" },
  { to: "/admin/providers", icon: Users, label: "Service Providers" },
  { to: "/admin/customers", icon: Contact, label: "Customers" },
  { to: "/admin/simulation", icon: FlaskConical, label: "Simulation" },
  { to: "/admin/workflow", icon: GitBranch, label: "Offer Workflow" },
  { to: "/admin/integrations", icon: Plug, label: "Integrations" },
  { to: "/admin/users", icon: UserCog, label: "Users" },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const role = user?.role ?? "sp";
  const links = role === "sp" ? spLinks : adminLinks;

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={`sticky top-0 flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            W
          </div>
          {!collapsed && (
            <span className="font-semibold tracking-tight text-sidebar-primary-foreground">
              Winducks
            </span>
          )}
        </div>

        {/* User info */}
        <div className="border-b border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
              {role === "admin" ? <Shield className="h-3.5 w-3.5" /> : <UserCircle className="h-3.5 w-3.5" />}
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
        </nav>

        {/* Logout + Collapse */}
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors border-t border-sidebar-border"
        >
          <LogOut className="h-3.5 w-3.5" />
          {!collapsed && "Logout"}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-10 items-center justify-center border-t border-sidebar-border text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
