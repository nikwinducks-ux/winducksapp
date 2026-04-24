import { Copy, MessageSquare, Phone, User } from "lucide-react";
import { toast } from "sonner";
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

function formatPhone(phone: string): string {
  // Pretty-print North American 10/11-digit numbers; otherwise return as-is.
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface ContactIconButtonProps {
  href: string;
  label: string;
  tooltip: string;
  children: React.ReactNode;
}

function ContactIconButton({
  href, label, tooltip, children,
}: ContactIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="outline" size="icon" className="h-8 w-8">
          <a
            href={href}
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {children}
          </a>
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

  const pretty = formatPhone(phone);
  const tel = `tel:${phone}`;
  const sms = `sms:${phone}`;

  const buttons = (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5 shrink-0">
        <ContactIconButton href={tel} label={`Call ${firstName}`} tooltip={`Call ${firstName}`}>
          <Phone className="h-4 w-4" />
        </ContactIconButton>
        <ContactIconButton href={sms} label={`Text ${firstName}`} tooltip={`Text ${firstName}`}>
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
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const ok = await copyToClipboard(phone);
              if (ok) toast.success(`Copied ${pretty}`);
            }}
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Copy ${pretty}`}
          >
            {pretty}
            <Copy className="h-3 w-3" />
          </button>
        </div>
        {buttons}
      </div>
    </div>
  );
}

export default CustomerContactActions;
