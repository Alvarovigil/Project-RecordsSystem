"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetRepository, setAuthenticated } from "@/lib/data";
import type { Profile } from "@/lib/data/types";

/**
 * Who is using the app.
 *
 * Signed out — or with Supabase not configured at all — the app keeps working
 * on the local backend, so nothing here is allowed to block the interface.
 */
export function useSession() {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setAuthenticated(Boolean(data.session));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthenticated(Boolean(next)); // the backend depends on being signed in
      resetRepository();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null);
      return;
    }
    let alive = true;
    supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        setProfile({
          id: data.id,
          username: data.username,
          displayName: data.display_name,
          bio: data.bio,
          avatarUrl: data.avatar_url,
        });
      });
    return () => {
      alive = false;
    };
  }, [supabase, session]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setAuthenticated(false);
    resetRepository();
    window.location.href = "/";
  }, [supabase]);

  return {
    available: Boolean(supabase),
    loading,
    session,
    user: session?.user ?? null,
    profile,
    signInWithGoogle,
    signOut,
  };
}
