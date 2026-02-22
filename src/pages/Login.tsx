import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, UserCircle, LogIn, Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, user, signOut } = useAuth();
  const [mode, setMode] = useState<"admin" | "sp" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedInWaiting, setSignedInWaiting] = useState(false);
  const [roleTimeout, setRoleTimeout] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigate once user/role is resolved
  useEffect(() => {
    if (signedInWaiting && user) {
      console.log("Role loaded:", user.role);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      navigate(user.role === "admin" ? "/admin" : "/", { replace: true });
    }
  }, [signedInWaiting, user, navigate]);

  // Safety fallback: 2s timeout for role resolution
  useEffect(() => {
    if (signedInWaiting && !user) {
      timeoutRef.current = setTimeout(() => {
        if (!user) {
          console.log("Role loaded: null (timeout)");
          setRoleTimeout(true);
        }
      }, 2000);
      return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }
  }, [signedInWaiting, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setRoleTimeout(false);
    console.log("Submitting login");
    try {
      const { error } = await signIn(email, password);
      if (error) {
        console.log("Login result: error", error);
        setError(error);
      } else {
        console.log("Login result: success");
        setSignedInWaiting(true);
      }
    } catch (err: any) {
      console.log("Login result: error", err);
      setError(err?.message ?? "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryRole = () => {
    setRoleTimeout(false);
    setSignedInWaiting(false);
    setError("");
    // Force re-check by signing out and letting user try again
    signOut();
  };

  // Post-login waiting state
  if (signedInWaiting && !roleTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Role timeout state
  if (signedInWaiting && roleTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 px-6 text-center">
          <p className="text-destructive font-medium">
            Signed in, but role not found. Please contact admin.
          </p>
          <Button onClick={handleRetryRole} variant="outline" className="w-full">
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
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
              W
            </div>
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

          <div className="text-center">
            <button onClick={() => navigate("/signup")} className="text-sm text-primary hover:underline">
              Create an account →
            </button>
          </div>

          <div className="metric-card p-4">
            <p className="text-xs text-muted-foreground text-center">
              <strong>Prototype credentials:</strong><br />
              Admin: admin@winducks.ca / admin123<br />
              SP: mike@example.com / sp123 (or any seeded SP email)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            W
          </div>
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
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</>
            ) : (
              <><LogIn className="h-4 w-4 mr-2" /> Sign In</>
            )}
          </Button>

          <button
            type="button"
            onClick={() => { setMode(null); setError(""); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to login options
          </button>
        </form>
      </div>
    </div>
  );
}
