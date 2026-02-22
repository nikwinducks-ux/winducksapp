import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Reset password action
    if (body.action === "reset-password") {
      const { userId, password } = body;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user action
    const { email, password, role, spId } = body;

    const { data: user, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) return new Response(JSON.stringify({ error: createErr.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });

    // Create role
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: user.user.id,
      role,
      sp_id: spId || null,
    });
    if (roleErr) return new Response(JSON.stringify({ error: roleErr.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });

    return new Response(JSON.stringify({ success: true, userId: user.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
