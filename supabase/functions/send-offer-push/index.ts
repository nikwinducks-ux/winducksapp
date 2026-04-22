/**
 * send-offer-push
 *
 * Triggered by Supabase Database Webhooks on public.offers.
 * - INSERT (status='Pending')              → "New job offer"
 * - UPDATE (status -> Accepted, AutoAccept) → "Auto-accepted job"
 *
 * Uses Web Push protocol (VAPID + aes128gcm) — no Node libraries.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OfferRecord {
  id: string;
  job_id: string;
  sp_id: string;
  status: string;
  acceptance_source?: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: OfferRecord;
  old_record: OfferRecord | null;
}

// ─── base64url helpers ───
function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// ─── Import VAPID private key (raw d) into a CryptoKey ───
async function importVapidPrivateKey(privateKeyB64: string, publicKeyB64: string): Promise<CryptoKey> {
  const pub = b64urlDecode(publicKeyB64); // 65 bytes uncompressed
  // strip leading 0x04
  const x = b64urlEncode(pub.slice(1, 33));
  const y = b64urlEncode(pub.slice(33, 65));
  const d = privateKeyB64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d,
    ext: true,
  };
  return await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

// ─── Sign VAPID JWT (ES256) ───
async function makeVapidJWT(audience: string, subject: string, publicKeyB64: string, privateKeyB64: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12h
    sub: subject,
  };
  const enc = new TextEncoder();
  const headerB64 = b64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importVapidPrivateKey(privateKeyB64, publicKeyB64);
  const sigDer = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput));
  // Web Crypto returns r||s already (64 bytes for P-256) — that's the JWS format.
  return `${signingInput}.${b64urlEncode(sigDer)}`;
}

// ─── HKDF helper using Web Crypto ───
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    baseKey,
    length * 8
  );
  return new Uint8Array(bits);
}

// ─── aes128gcm Web Push encryption (RFC 8291 / 8188) ───
async function encryptPayload(
  payload: string,
  uaPublicB64: string,
  authSecretB64: string
): Promise<{ body: Uint8Array }> {
  const uaPublic = b64urlDecode(uaPublicB64); // 65 bytes
  const authSecret = b64urlDecode(authSecretB64);

  // Generate ephemeral ECDH keypair (server)
  const asKeypair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeypair.publicKey));

  // Import UA public key
  const uaPubKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const ecdhBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPubKey },
    asKeypair.privateKey,
    256
  );
  const ecdhSecret = new Uint8Array(ecdhBits);

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK_key = HKDF(authSecret, ecdhSecret, "WebPush: info\0" || uaPublic || asPublic, 32)
  const enc = new TextEncoder();
  const keyInfo = concat(
    enc.encode("WebPush: info\0"),
    uaPublic,
    asPublicRaw
  );
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // CEK = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  // NONCE = HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // Plaintext + 0x02 padding delimiter (single record, no extra padding)
  const plaintext = concat(enc.encode(payload), new Uint8Array([0x02]));

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext)
  );

  // Build aes128gcm header: salt(16) | rs(4 BE) | idlen(1) | keyid(asPublicRaw, 65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const idlen = new Uint8Array([asPublicRaw.length]);
  const header = concat(salt, rs, idlen, asPublicRaw);
  const body = concat(header, ciphertext);

  return { body };
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPub: string,
  vapidPriv: string,
  vapidSubject: string
): Promise<{ ok: boolean; status: number; body?: string }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await makeVapidJWT(audience, vapidSubject, vapidPub, vapidPriv);

  const { body } = await encryptPayload(payload, sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "60",
      "Authorization": `vapid t=${jwt}, k=${vapidPub}`,
    },
    body,
  });
  let respBody: string | undefined;
  if (!res.ok) {
    try { respBody = await res.text(); } catch (_e) { /* ignore */ }
  }
  return { ok: res.ok, status: res.status, body: respBody };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload: WebhookPayload = await req.json();
    if (payload.table !== "offers") {
      return new Response(JSON.stringify({ skipped: true, reason: "wrong_table" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const offer = payload.record;
    const old = payload.old_record;

    let title = "";
    let bodyText = "";
    let url = "/";

    if (payload.type === "INSERT" && offer.status === "Pending") {
      title = "New job offer";
      bodyText = "Tap to review the offer in Winducks.";
      url = `/jobs/${offer.job_id}?offer=${offer.id}`;
    } else if (
      payload.type === "UPDATE" &&
      offer.status === "Accepted" &&
      old?.status !== "Accepted" &&
      offer.acceptance_source === "AutoAccept"
    ) {
      title = "Auto-accepted job";
      bodyText = "We accepted this offer for you.";
      url = `/jobs/${offer.job_id}`;
    } else {
      return new Response(JSON.stringify({ skipped: true, reason: "no_match" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSub = Deno.env.get("VAPID_SUBJECT") ?? "mailto:owner@winducks.com";
    if (!vapidPub || !vapidPriv) {
      console.error("VAPID keys not configured");
      return new Response(JSON.stringify({ error: "VAPID not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("sp_id", offer.sp_id);

    if (subsErr) {
      console.error("subscriptions fetch error", subsErr);
      return new Response(JSON.stringify({ error: subsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messagePayload = JSON.stringify({
      title,
      body: bodyText,
      url,
      tag: `offer-${offer.id}`,
    });

    const results = await Promise.all(
      subs.map(async (s: any) => {
        try {
          const r = await sendWebPush(s, messagePayload, vapidPub, vapidPriv, vapidSub);
          if (!r.ok && (r.status === 404 || r.status === 410)) {
            await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
          return { endpoint: s.endpoint, status: r.status, ok: r.ok };
        } catch (e) {
          console.error("push send failed", s.endpoint, e);
          return { endpoint: s.endpoint, ok: false, error: (e as Error).message };
        }
      })
    );

    return new Response(JSON.stringify({ success: true, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-offer-push error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
