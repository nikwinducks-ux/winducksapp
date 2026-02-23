import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check: require valid JWT + admin role ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: jsonHeaders, status: 401 });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: jsonHeaders, status: 401 });
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), { headers: jsonHeaders, status: 403 });
    }

    // ── Proceed with admin operations ──
    const body = await req.json();

    // List users action
    if (body.action === "list-users") {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) return new Response(JSON.stringify({ error: error.message }), { headers: jsonHeaders, status: 400 });
      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
      }));
      return new Response(JSON.stringify({ users }), { headers: jsonHeaders });
    }

    // Update role action
    if (body.action === "update-role") {
      const { userId: targetUserId, role, spId } = body;
      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .update({ role, sp_id: role === "sp" ? spId || null : null })
          .eq("user_id", targetUserId);
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers: jsonHeaders, status: 400 });
      } else {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: targetUserId, role, sp_id: role === "sp" ? spId || null : null });
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers: jsonHeaders, status: 400 });
      }
      return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
    }

    // Reset password action
    if (body.action === "reset-password") {
      const { userId: targetUserId, password } = body;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password });
      if (error) return new Response(JSON.stringify({ error: error.message }), { headers: jsonHeaders, status: 400 });
      return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
    }

    // Create user action
    const { email, password, role, spId } = body;

    const { data: user, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) return new Response(JSON.stringify({ error: createErr.message }), { headers: jsonHeaders, status: 400 });

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: user.user.id,
      role,
      sp_id: spId || null,
    });
    if (roleErr) return new Response(JSON.stringify({ error: roleErr.message }), { headers: jsonHeaders, status: 400 });

    return new Response(JSON.stringify({ success: true, userId: user.user.id }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers: jsonHeaders, status: 500 });
  }
});
