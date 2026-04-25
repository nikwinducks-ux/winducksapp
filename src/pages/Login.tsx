import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, UserCircle, LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LoginPhase = "form" | "loading" | "failed";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signOut } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"admin" | "sp" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<LoginPhase>("form");
  const [showForgot, setShowForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  // Fetch role directly with retries — does not depend on AuthContext propagation.
  async function fetchRoleWithRetries(userId: string): Promise<{ role: string; isActive: boolean } | null> {
    const delays = [0, 400, 800, 1500];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
      console.log(`[Login] Inline role fetch attempt ${attempt + 1}`);
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role, is_active")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (error) {
          console.log(`[Login] Inline role error:`, error.message);
          continue;
        }
        if (data) {
          console.log(`[Login] Inline role resolved:`, data.role, "active:", data.is_active);
          return { role: data.role as string, isActive: data.is_active ?? true };
        }
      } catch (err: any) {
        console.log(`[Login] Inline role exception:`, err?.message);
      }
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPhase("loading");
    console.log("[Login] Submitting");

    try {
      const { error: signInErr } = await signIn(email, password);
      if (signInErr) {
        console.log("[Login] Sign-in error:", signInErr);
        setError(signInErr);
        setPhase("form");
        return;
      }

      // Get the freshly authenticated user directly from supabase
      const { data: { user: authUser }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !authUser) {
        console.log("[Login] getUser failed:", userErr?.message);
        setError("Sign-in succeeded but session could not be read. Please try again.");
        setPhase("form");
        return;
      }

      // Fetch role inline with retries
      const roleData = await fetchRoleWithRetries(authUser.id);
      if (!roleData) {
        console.log("[Login] Role fetch exhausted retries");
        setPhase("failed");
        return;
      }

      if (!roleData.isActive) {
        setError("Your account has been disabled. Please contact your admin.");
        await signOut();
        setPhase("form");
        return;
      }

      // Navigate immediately based on the role we just fetched.
      const target = (roleData.role === "admin" || roleData.role === "owner") ? "/admin" : "/";
      console.log("[Login] Navigating to", target);
      navigate(target, { replace: true });
    } catch (err: any) {
      console.log("[Login] Unexpected error:", err);
      setError(err?.message ?? "An unexpected error occurred.");
      setPhase("form");
    }
  };

  const handleRetry = async () => {
    setPhase("form");
    setError("");
    await signOut();
  };

  // Loading state during sign-in + role fetch
  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Signing you in...</p>
        </div>
      </div>
    );
  }

  // Failure state — only shown after retries are exhausted
  if (phase === "failed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 px-6 text-center">
          <p className="text-destructive font-medium">
            Sign-in succeeded, but we couldn't load your account details.
          </p>
          <p className="text-sm text-muted-foreground">
            This is usually a slow connection. Please check your network and try again. If the problem persists, contact your admin.
          </p>
          <Button onClick={handleRetry} variant="outline" className="w-full">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-8 px-6">
          <div className="text-center space-y-2">
            <img
              src="/assets/branding/winducks-logo-login.png"
              alt="Winducks logo"
              className="h-20 w-auto object-contain mx-auto"
            />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Winducks</h1>
            <p className="text-sm text-muted-foreground">SP Allocation Platform</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { setMode("admin"); setEmail("admin@winducks.ca"); }}
              className="metric-card flex w-full items-center gap-4 p-5 cursor-pointer hover:border-primary/40 transition-colors text-left"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Admin Login</p>
                <p className="text-sm text-muted-foreground">Manage allocation, providers, and jobs</p>
              </div>
            </button>

            <button
              onClick={() => { setMode("sp"); setEmail(""); }}
              className="metric-card flex w-full items-center gap-4 p-5 cursor-pointer hover:border-primary/40 transition-colors text-left"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent">
                <UserCircle className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Service Provider Login</p>
                <p className="text-sm text-muted-foreground">View jobs, availability, and performance</p>
              </div>
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Contact your administrator to create an account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="text-center space-y-2">
          <img
            src="/assets/branding/winducks-logo-login.png"
            alt="Winducks logo"
            className="h-20 w-auto object-contain mx-auto"
          />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {mode === "admin" ? "Admin Login" : "Service Provider Login"}
          </h1>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full">
            <LogIn className="h-4 w-4 mr-2" /> Sign In
          </Button>

          <button
            type="button"
            onClick={() => { setShowForgot(true); setForgotEmail(email); }}
            className="w-full text-sm text-primary hover:underline"
          >
            Forgot password?
          </button>

          <button
            type="button"
            onClick={() => { setMode(null); setError(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to login options
          </button>
        </form>

        {showForgot && (
          <div className="metric-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Reset Password</h3>
            <p className="text-xs text-muted-foreground">Enter your email to receive a password reset link.</p>
            <Input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={sendingReset || !forgotEmail}
                onClick={async () => {
                  setSendingReset(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setSendingReset(false);
                  if (error) {
                    toast({ title: "Error", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: "Reset link sent", description: "Check your email for a password reset link." });
                    setShowForgot(false);
                  }
                }}
              >
                {sendingReset ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForgot(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
