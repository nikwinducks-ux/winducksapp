import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "sp";
  spId: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchRole(authUser: User): Promise<AuthUser | null> {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, sp_id")
        .eq("user_id", authUser.id)
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: authUser.id,
        email: authUser.email ?? "",
        role: data.role as "admin" | "sp",
        spId: data.sp_id,
      };
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let isMounted = true;

    // Listener for ONGOING auth changes — never awaits, uses setTimeout to avoid deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);

        if (session?.user) {
          // Use setTimeout to avoid deadlock from awaiting inside the callback
          setTimeout(async () => {
            if (!isMounted) return;
            const authUser = await fetchRole(session.user);
            if (isMounted) setUser(authUser);
          }, 0);
        } else {
          setUser(null);
        }
      }
    );

    // INITIAL load — controls loading state
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);

        if (session?.user) {
          const authUser = await fetchRole(session.user);
          if (isMounted) setUser(authUser);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
