import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    // List users action - returns auth user emails
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
      const { userId, role, spId } = body;
      // Upsert: update existing role row or insert if missing
      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .update({ role, sp_id: role === "sp" ? spId || null : null })
          .eq("user_id", userId);
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers: jsonHeaders, status: 400 });
      } else {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role, sp_id: role === "sp" ? spId || null : null });
        if (error) return new Response(JSON.stringify({ error: error.message }), { headers: jsonHeaders, status: 400 });
      }
      return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
    }

    // Reset password action
    if (body.action === "reset-password") {
      const { userId, password } = body;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
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
