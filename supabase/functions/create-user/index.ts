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

    // Check admin/owner role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role, is_active")
      .eq("user_id", userId)
      .in("role", ["admin", "owner"])
      .maybeSingle();

    if (!roleRow || !roleRow.is_active) {
      return new Response(JSON.stringify({ error: "Forbidden: active admin/owner role required" }), { headers: jsonHeaders, status: 403 });
    }

    const callerRole = roleRow.role;

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

    // Disable user action (owner-only for admin/owner targets)
    if (body.action === "disable-user") {
      const { userId: targetUserId, reason } = body;
      // Check target's role
      const { data: targetRole } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", targetUserId).maybeSingle();
      if (targetRole?.role === "owner") {
        return new Response(JSON.stringify({ error: "Cannot disable an Owner account" }), { headers: jsonHeaders, status: 403 });
      }
      if (targetRole?.role === "admin" && callerRole !== "owner") {
        return new Response(JSON.stringify({ error: "Only Owners can disable Admin accounts" }), { headers: jsonHeaders, status: 403 });
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ is_active: false, disabled_at: new Date().toISOString(), disabled_reason: reason || "Disabled by admin" })
        .eq("user_id", targetUserId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { headers: jsonHeaders, status: 400 });
      return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
    }

    // Enable user action (owner-only for admin targets)
    if (body.action === "enable-user") {
      const { userId: targetUserId } = body;
      const { data: targetRole } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", targetUserId).maybeSingle();
      if ((targetRole?.role === "admin" || targetRole?.role === "owner") && callerRole !== "owner") {
        return new Response(JSON.stringify({ error: "Only Owners can enable Admin accounts" }), { headers: jsonHeaders, status: 403 });
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ is_active: true, disabled_at: null, disabled_reason: null })
        .eq("user_id", targetUserId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { headers: jsonHeaders, status: 400 });
      return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
    }

    // Update role action (owner-only for changing admin/owner roles)
    if (body.action === "update-role") {
      const { userId: targetUserId, role, spId } = body;
      // Check target's current role
      const { data: targetRole } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", targetUserId).maybeSingle();
      // Only owners can change admin/owner roles or promote to admin/owner
      if ((targetRole?.role === "admin" || targetRole?.role === "owner" || role === "admin" || role === "owner") && callerRole !== "owner") {
        return new Response(JSON.stringify({ error: "Only Owners can modify admin roles" }), { headers: jsonHeaders, status: 403 });
      }
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

    // Promote owner action (temporary, single-use)
    if (body.action === "promote-owner") {
      if (callerRole !== "admin") {
        return new Response(JSON.stringify({ error: "Only admin can use this action" }), { headers: jsonHeaders, status: 403 });
      }

      const { data: callerUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (!callerUser?.user?.email || callerUser.user.email !== "quack@winducks.com") {
        return new Response(JSON.stringify({ error: "Unauthorized: email mismatch" }), { headers: jsonHeaders, status: 403 });
      }

      // Check if already owner (single-use guard)
      const { data: currentRole } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      if (currentRole?.role === "owner") {
        return new Response(JSON.stringify({ error: "Already an Owner. This action cannot be repeated." }), { headers: jsonHeaders, status: 400 });
      }

      const { error: promoteErr } = await supabaseAdmin
        .from("user_roles")
        .update({ role: "owner" })
        .eq("user_id", userId);
      if (promoteErr) {
        return new Response(JSON.stringify({ error: promoteErr.message }), { headers: jsonHeaders, status: 400 });
      }

      // Audit log
      await supabaseAdmin.from("admin_audit_logs").insert({
        user_id: userId,
        user_email: callerUser.user.email,
        action: "promote-owner",
        details: { message: "Promoted to owner via Owner Setup page" },
      });

      return new Response(JSON.stringify({ success: true, message: "Promoted to owner." }), { headers: jsonHeaders });
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
