/**
 * send-offer-sms
 *
 * Triggered by a Supabase Database Webhook on INSERT into public.offers.
 * Sends an SMS to the SP via Twilio with a direct deep-link to the offer.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OfferRecord {
  id: string;
  job_id: string;
  sp_id: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: OfferRecord;
  old_record: OfferRecord | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();

    if (payload.type !== "INSERT" || payload.record.status !== "Pending") {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const offer = payload.record;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [{ data: sp }, { data: job }] = await Promise.all([
      supabase
        .from("service_providers")
        .select("id, name, phone")
        .eq("id", offer.sp_id)
        .single(),
      supabase
        .from("jobs")
        .select("id, service_category, job_address_street, job_address_city, scheduled_date, scheduled_time, payout, urgency")
        .eq("id", offer.job_id)
        .single(),
    ]);

    if (!sp || !job) {
      console.error("SP or job not found", { spId: offer.sp_id, jobId: offer.job_id });
      return new Response(JSON.stringify({ error: "SP or job not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = sp.phone?.trim();
    if (!phone) {
      console.log(`SP ${sp.name} has no phone number — skipping SMS`);
      return new Response(JSON.stringify({ skipped: true, reason: "no_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://winducksapp.lovable.app";
    const offerUrl = `${appBaseUrl}/jobs/${offer.job_id}?offer=${offer.id}`;

    const expiresAt = new Date(offer.expires_at);
    const expiresInMinutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);

    let scheduleText = "";
    if (job.urgency === "ASAP") {
      scheduleText = "⚡ ASAP";
    } else if (job.urgency === "AnytimeSoon") {
      scheduleText = "🕐 Anytime soon";
    } else {
      scheduleText = job.scheduled_date
        ? `📅 ${job.scheduled_date}${job.scheduled_time ? " @ " + job.scheduled_time : ""}`
        : "Schedule TBD";
    }

    const message = [
      `🦆 Winducks — New Job Offer`,
      ``,
      `Hi ${sp.name.split(" ")[0]}! You have a new job offer:`,
      ``,
      `🧹 ${job.service_category}`,
      `📍 ${job.job_address_street}, ${job.job_address_city}`,
      `${scheduleText}`,
      `💰 $${job.payout}`,
      ``,
      `⏱ Expires in ${expiresInMinutes} min`,
      ``,
      `View & accept:`,
      offerUrl,
    ].join("\n");

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!twilioSid || !twilioToken || !twilioFrom) {
      console.error("Missing Twilio environment variables");
      return new Response(JSON.stringify({ error: "Twilio not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhone = normalizeCanadianPhone(phone);
    if (!normalizedPhone) {
      console.error(`Invalid phone number for SP ${sp.name}: ${phone}`);
      return new Response(JSON.stringify({ error: "Invalid phone number", phone }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const body = new URLSearchParams({
      To: normalizedPhone,
      From: twilioFrom,
      Body: message,
    });

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
      },
      body,
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio error", twilioData);
      return new Response(JSON.stringify({ error: "Twilio send failed", details: twilioData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`SMS sent to ${sp.name} (${normalizedPhone}) for offer ${offer.id}`);

    return new Response(
      JSON.stringify({ success: true, messageSid: twilioData.sid, to: normalizedPhone }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-offer-sms error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function normalizeCanadianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (phone.startsWith("+") && digits.length >= 10) return "+" + digits;
  return null;
}
