// seed-users: DISABLED for production security.
// User seeding is only available via the create-user admin edge function.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ error: "seed-users is disabled in production. Use admin UI to create users." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
