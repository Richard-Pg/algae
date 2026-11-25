"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import type { Me } from "@/lib/types";

type Result = Promise<{ error: string | null }>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  /** Profile from the API, including whether the user is a reviewer. */
  me: Me | null;
  /** True while the API profile for the signed-in user is being fetched. */
  meLoading: boolean;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Result;
  signIn: (email: string, password: string) => Result;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Result;
  resetPassword: (email: string) => Result;
  updatePassword: (newPassword: string) => Result;
  refreshMe: () => Promise<void>;
  /** Open the shared sign-in dialog, optionally explaining why. */
  requestSignIn: (message?: string) => void;
  authPrompt: { open: boolean; message?: string };
  closeSignIn: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authPrompt, setAuthPrompt] = useState<{ open: boolean; message?: string }>({ open: false });

  const refreshMe = useCallback(async () => {
    setMeLoading(true);
    try {
      setMe(await api<Me>("/api/me"));
    } catch {
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
      if (next?.user) setAuthPrompt({ open: false });
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  // Keep the API profile in step with the signed-in user.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setMe(null);
      return;
    }
    refreshMe();
  }, [userId, refreshMe]);

  const wrap = (error: { message: string } | null) => ({ error: error ? error.message : null });

  const value: AuthContextType = {
    user,
    session,
    me,
    meLoading,
    loading,
    isAdmin: Boolean(me?.is_admin),
    signUp: async (email, password) =>
      wrap((await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })).error),
    signIn: async (email, password) => wrap((await supabase.auth.signInWithPassword({ email, password })).error),
    signOut: async () => {
      await supabase.auth.signOut();
    },
    updateProfile: async (displayName) => {
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
      if (!error) {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
        await refreshMe();
      }
      return wrap(error);
    },
    resetPassword: async (email) =>
      wrap(
        (await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }))
          .error,
      ),
    updatePassword: async (newPassword) => wrap((await supabase.auth.updateUser({ password: newPassword })).error),
    refreshMe,
    requestSignIn: (message) => setAuthPrompt({ open: true, message }),
    authPrompt,
    closeSignIn: () => setAuthPrompt({ open: false }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
