"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetRepository, setAuthenticated } from "@/lib/data";
import { clearSnapshots } from "@/lib/data/snapshot";
import type { Profile } from "@/lib/data/types";
import { FAKE_SESSION, FAKE_USER } from "@/lib/dev-session";
import { DEMO_PROFILE } from "@/lib/demo";

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

  /**
   * Always ask which account.
   *
   * Google's default is to reuse whichever session the browser already has,
   * silently — one tap and you are in, as somebody. That is fine when a person
   * has one account and quietly wrong when they have two: the phone signs you
   * into the wrong shelf, and the only visible way out is to sign out of
   * Google entirely. `prompt=select_account` costs one screen and makes the
   * choice explicit, which is the correct trade for an app whose whole content
   * is personal.
   */
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    // the cached library goes with the session: nobody should open this phone
    // and find the last person's collection painted for a second
    clearSnapshots();
    setAuthenticated(false);
    resetRepository();
    window.location.href = "/";
  }, [supabase]);

  // building the signed-in interface without signing in: see lib/dev-session.ts
  const faking = FAKE_SESSION && !session;

  return {
    available: Boolean(supabase) || faking,
    loading: faking ? false : loading,
    session,
    user: faking ? FAKE_USER : session?.user ?? null,
    profile: faking ? DEMO_PROFILE : profile,
    signInWithGoogle,
    signOut,
  };
}
