import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION synchronously with the current
    // session, so a separate getSession() call is unnecessary and causes lock
    // contention in @supabase/auth-js (the "lock not released within 5000ms"
    // warning).  A safety timeout ensures we still show the login screen if
    // the initial event never arrives.
    const timer = setTimeout(() => {
      setLoading(false); // show login screen on timeout
    }, 5000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      clearTimeout(timer);
      setSession(s);
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signInAsGuest = useCallback(async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const user: User | null = session?.user ?? null;
  const isGuest = user?.is_anonymous ?? false;

  return { session, user, loading, signIn, signUp, signInAsGuest, signOut, isGuest };
}
