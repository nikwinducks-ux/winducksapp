import { MessageSquare, Phone, User } from "lucide-react";
import { useCustomer } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface CustomerContactActionsProps {
  customerId: string | undefined;
  customerName?: string;
  variant?: "card" | "inline";
}

function cleanPhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned || null;
}

/**
 * Open a tel:/sms: URL reliably even when rendered inside a sandboxed
 * preview iframe (where plain <a href="tel:..."> can be silently blocked).
 * Tries the top-level window first, then window.open, then a same-window assign.
 */
function openContactUrl(url: string) {
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // cross-origin top access blocked — fall through
  }
  const opened = window.open(url, "_top");
  if (!opened) {
    window.location.href = url;
  }
}

interface ContactIconButtonProps {
  url: string;
  label: string;
  tooltip: string;
  children: React.ReactNode;
}

function ContactIconButton({ url, label, tooltip, children }: ContactIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label={label}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openContactUrl(url);
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Phone/SMS quick-action icons for contacting the customer of a job.
 * Mirrors the pattern used in CrewTeammates (teammate contact buttons).
 */
export function CustomerContactActions({
  customerId,
  customerName,
  variant = "card",
}: CustomerContactActionsProps) {
  const { data: customer, isLoading } = useCustomer(customerId);

  if (isLoading || !customer) return null;

  // Prefer primary contact phone, then any contact phone, then customer.phone
  const primaryContact =
    customer.contacts?.find((c) => c.isPrimary) ?? customer.contacts?.[0];
  const phone =
    cleanPhone(primaryContact?.phone) ?? cleanPhone(customer.phone);

  const displayName = customerName || customer.name || "customer";
  const firstName = displayName.split(/\s+/)[0] ?? "customer";

  if (!phone) {
    if (variant === "inline") return null;
    return (
      <div className="rounded-md border bg-muted/20 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">— no phone on file</p>
          </div>
        </div>
      </div>
    );
  }

  const telUrl = `tel:${phone}`;
  const smsUrl = `sms:${phone}`;

  const buttons = (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5 shrink-0">
        <ContactIconButton url={telUrl} label={`Call ${firstName}`} tooltip={`Call ${firstName}`}>
          <Phone className="h-4 w-4" />
        </ContactIconButton>
        <ContactIconButton url={smsUrl} label={`Text ${firstName}`} tooltip={`Text ${firstName}`}>
          <MessageSquare className="h-4 w-4" />
        </ContactIconButton>
      </div>
    </TooltipProvider>
  );

  if (variant === "inline") return buttons;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Customer</p>
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{phone}</p>
        </div>
        {buttons}
      </div>
    </div>
  );
}

export default CustomerContactActions;
