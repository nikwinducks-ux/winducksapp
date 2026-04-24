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
const telHref = (p?: string | null) => {
  const c = cleanPhone(p); return c ? `tel:${c}` : null;
};
const smsHref = (p?: string | null) => {
  const c = cleanPhone(p); return c ? `sms:${c}` : null;
};

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
  const phone = cleanPhone(primaryContact?.phone) ?? cleanPhone(customer.phone);

  const displayName = customerName || customer.name || "customer";
  const firstName = displayName.split(/\s+/)[0] ?? "customer";

  const tel = telHref(phone);
  const sms = smsHref(phone);

  if (!tel && !sms) return null;

  if (variant === "inline") {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-1.5">
          {tel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="outline" size="icon" className="h-8 w-8">
                  <a href={tel} aria-label={`Call ${firstName}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Call {firstName}</TooltipContent>
            </Tooltip>
          )}
          {sms && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="outline" size="icon" className="h-8 w-8">
                  <a href={sms} aria-label={`Text ${firstName}`}>
                    <MessageSquare className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Text {firstName}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Customer</p>
          <p className="text-sm font-medium truncate">{displayName}</p>
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-1.5 shrink-0">
            {tel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="outline" size="icon" className="h-8 w-8">
                    <a href={tel} aria-label={`Call ${firstName}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Call {firstName}</TooltipContent>
              </Tooltip>
            )}
            {sms && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="outline" size="icon" className="h-8 w-8">
                    <a href={sms} aria-label={`Text ${firstName}`}>
                      <MessageSquare className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Text {firstName}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}

export default CustomerContactActions;
