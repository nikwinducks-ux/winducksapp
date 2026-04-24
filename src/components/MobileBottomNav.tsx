import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Briefcase,
  Settings,
  Tag,
  Contact,
  MoreHorizontal,
} from "lucide-react";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  exact?: boolean;
}

const spItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Home", exact: true },
  { to: "/my-jobs", icon: ClipboardList, label: "Jobs" },
  { to: "/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/jobs", icon: Briefcase, label: "Offers" },
  { to: "/account", icon: Settings, label: "Account" },
];

const adminItems: NavItem[] = [
  { to: "/admin", icon: LayoutDashboard, label: "Home", exact: true },
  { to: "/admin/jobs", icon: Briefcase, label: "Jobs" },
  { to: "/admin/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/admin/customers", icon: Contact, label: "Customers" },
  { to: "/admin/providers", icon: MoreHorizontal, label: "More" },
];

interface Props {
  isAdmin: boolean;
}

export function MobileBottomNav({ isAdmin }: Props) {
  const location = useLocation();
  const items = isAdmin ? adminItems : spItems;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-background lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const isActive = item.exact
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
