import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Check if users already seeded
    const { data: existingRoles } = await admin.from("user_roles").select("id", { count: "exact", head: true });
    if ((existingRoles as any)?.length > 0) {
      // Also try count
      const { count } = await admin.from("user_roles").select("*", { count: "exact", head: true });
      if ((count ?? 0) > 0) {
        return new Response(JSON.stringify({ message: "Users already seeded" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create admin user
    const { data: adminUser, error: adminErr } = await admin.auth.admin.createUser({
      email: "admin@winducks.ca",
      password: "admin123",
      email_confirm: true,
    });
    if (adminErr) throw adminErr;

    // Insert admin role
    await admin.from("user_roles").insert({
      user_id: adminUser.user.id,
      role: "admin",
      sp_id: null,
    });

    // Get all SPs
    const { data: sps } = await admin.from("service_providers").select("id, email");

    // Create SP users
    for (const sp of sps ?? []) {
      const { data: spUser, error: spErr } = await admin.auth.admin.createUser({
        email: sp.email,
        password: "sp123",
        email_confirm: true,
      });
      if (spErr) {
        console.error(`Error creating user for ${sp.email}:`, spErr.message);
        continue;
      }
      await admin.from("user_roles").insert({
        user_id: spUser.user.id,
        role: "sp",
        sp_id: sp.id,
      });
    }

    return new Response(JSON.stringify({ message: "Users seeded successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
