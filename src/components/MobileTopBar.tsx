import { Menu, History } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  onOpenMenu: () => void;
  onOpenHistory?: () => void;
  historyUnread?: number;
}

export function MobileTopBar({ title, onOpenMenu, onOpenHistory, historyUnread = 0 }: Props) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 w-full items-center gap-2 px-3">
        <Button variant="ghost" size="icon" onClick={onOpenMenu} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <img
          src="/assets/branding/winducks-iconw.png"
          alt=""
          className="h-7 w-7 rounded-md object-contain"
        />
        <h1 className="flex-1 truncate text-base font-semibold tracking-tight">{title}</h1>
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
      </div>
    </header>
  );
}
