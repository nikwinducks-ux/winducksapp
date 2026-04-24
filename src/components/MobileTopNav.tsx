import { NavLink, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Calendar, Zap, TrendingUp,
  Sliders, Scale, Users, FlaskConical, GitBranch, Plug, Tag,
  Shield, UserCircle, Contact, LogOut, ClipboardList, Settings,
  TestTube, CalendarDays, Smartphone, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NavLinkItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
};

interface Props {
  title: string;
  links: NavLinkItem[];
  isAdmin: boolean;
  user: any;
  signOut: () => void;
  onOpenHistory?: () => void;
  historyUnread?: number;
}

export function MobileTopNav({
  title,
  links,
  isAdmin,
  user,
  signOut,
  onOpenHistory,
  historyUnread = 0,
}: Props) {
  const location = useLocation();
  const role = user?.role ?? "sp";

  return (
    <header
      className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 xl:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Row 1: header */}
      <div className="flex h-14 items-center gap-2 px-3">
        <img
          src="/assets/branding/winducks-iconw.png"
          alt=""
          className="h-8 w-8 shrink-0 rounded-md object-contain"
        />
        <h1 className="flex-1 truncate text-base font-semibold tracking-tight">
          {title}
        </h1>

        {onOpenHistory && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenHistory}
            aria-label="Open history"
            className="relative"
          >
            <History className="h-5 w-5" />
            {historyUnread > 0 && (
              <span className="absolute right-1 top-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
                {historyUnread > 99 ? "99+" : historyUnread}
              </span>
            )}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
              aria-label="Account menu"
            >
              {isAdmin ? (
                <Shield className="h-4 w-4" />
              ) : (
                <UserCircle className="h-4 w-4" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-xs font-medium truncate">{user?.email}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{role}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/install" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Install app
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: scrollable nav tabs */}
      <nav className="flex gap-1 overflow-x-auto scroll-smooth px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((link) => {
          const isActive =
            link.to === "/" || link.to === "/admin"
              ? location.pathname === link.to
              : location.pathname.startsWith(link.to);
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <link.icon className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
}
