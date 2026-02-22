import { NavLink, useLocation } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import {
  LayoutDashboard, Briefcase, Calendar, Zap, TrendingUp,
  Sliders, Scale, Users, FlaskConical, GitBranch, Plug,
  ChevronLeft, ChevronRight, Shield, UserCircle, Contact,
} from "lucide-react";
import { useState } from "react";

const spLinks = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/jobs", icon: Briefcase, label: "Job Offers" },
  { to: "/availability", icon: Calendar, label: "Availability" },
  { to: "/auto-accept", icon: Zap, label: "Auto-Accept" },
  { to: "/performance", icon: TrendingUp, label: "Performance" },
];

const adminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/allocation", icon: Sliders, label: "Allocation Control" },
  { to: "/admin/fairness", icon: Scale, label: "Fairness Controls" },
  { to: "/admin/providers", icon: Users, label: "Service Providers" },
  { to: "/admin/customers", icon: Contact, label: "Customers" },
  { to: "/admin/simulation", icon: FlaskConical, label: "Simulation" },
  { to: "/admin/workflow", icon: GitBranch, label: "Offer Workflow" },
  { to: "/admin/integrations", icon: Plug, label: "Integrations" },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { role, setRole } = useRole();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
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

        {/* Role Switcher */}
        <div className="border-b border-sidebar-border p-2">
          <div className={`flex ${collapsed ? "flex-col" : ""} gap-1`}>
            <button
              onClick={() => setRole("sp")}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                role === "sp"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              } ${collapsed ? "justify-center" : "flex-1 justify-center"}`}
            >
              <UserCircle className="h-3.5 w-3.5" />
              {!collapsed && "SP"}
            </button>
            <button
              onClick={() => setRole("admin")}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                role === "admin"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              } ${collapsed ? "justify-center" : "flex-1 justify-center"}`}
            >
              <Shield className="h-3.5 w-3.5" />
              {!collapsed && "Admin"}
            </button>
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

        {/* Collapse Toggle */}
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
