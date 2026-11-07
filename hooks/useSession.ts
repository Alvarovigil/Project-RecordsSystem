"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetRepository, setAuthenticated } from "@/lib/data";
import { clearSnapshots } from "@/lib/data/snapshot";
import type { Profile } from "@/lib/data/types";
import { FAKE_SESSION, FAKE_USER } from "@/lib/dev-session";
import { DEMO_PROFILE } from "@/lib/demo";
import { leaveLayers } from "@/hooks/useBackToClose";

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
  /**
   * `next` is where to come back to after Google. Typed loosely on purpose:
   * this is handed straight to onClick in a dozen places, so it usually
   * receives a click event, which is ignored.
   */
  const signInWithGoogle = useCallback(async (next?: unknown) => {
    if (!supabase) return;
    const back =
      typeof next === "string" && next ? `?next=${encodeURIComponent(safeNext(next))}` : "";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${back}`,
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
    // una carga entera a propósito: que no quede nada de la sesión en memoria
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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

/**
 * Somebody looking without an account, on a site that has accounts.
 *
 * They have no collection, so nothing on screen should talk to them about
 * "tu colección" — the local preview shelf is a sample, not theirs. False while
 * the session is still being read, so a signed-in visit never flashes the
 * visitor wording first.
 */
export function useIsVisitor() {
  const { available, loading, user } = useSession();
  return available && !loading && !user;
}

/**
 * The one answer every «+», «Guardar» and «Añadir» gives a visitor.
 *
 * Without an account there is no collection to write to — only the sample
 * shelf, which is nobody's and which Colección does not even show them. So a
 * write gesture is a request to come in: `gate()` sends them to /entrar and
 * returns true, and the caller stops there, without writing and without a
 * «guardado» toast. One function so no button has to work this out alone.
 */
export function useEntryGate() {
  const { available, loading, user } = useSession();
  const router = useRouter();
  return useCallback(() => {
    // no accounts on this site (the local-only app), or a real one: write
    if (!available || user) return false;
    // Still reading the session: nothing is written, and nobody is sent
    // anywhere either — a signed-in person tapping in that instant would
    // otherwise go through the door and bounce back. The tap is simply
    // dropped; the session lands in a moment and the next one counts.
    if (loading) return true;
    // se llama desde dentro de una capa (el escáner): primero salen sus
    // entradas, o la vuelta atrás del cierre se traga la navegación
    leaveLayers(() => router.push(entryHref()));
    return true;
  }, [available, loading, user, router]);
}

/**
 * Whether a write must not happen right now: signed out, or not known yet.
 *
 * useIsVisitor is false while the session loads, which is right for wording
 * (a member never flashes the visitor's sentences) and wrong for writing: a
 * write in that instant would go to whichever backend happened to be built,
 * possibly the visitor's sample shelf. For writes, unknown counts as no.
 */
export function useWriteBlocked() {
  const { available, loading, user } = useSession();
  return available && (loading || !user);
}

/**
 * /entrar, remembering where the person was.
 *
 * Somebody who taps «Seguir» on a profile and signs in should land back on
 * that profile, not on an empty shelf of their own with the thing they wanted
 * to do three screens away. The path rides to /entrar as `next`, and from
 * there to the auth callback, which already refuses anything off-site.
 */
export function entryHref() {
  if (typeof window === "undefined") return "/entrar";
  const here = window.location.pathname + window.location.search;
  if (here.startsWith("/entrar")) return "/entrar";
  return `/entrar?next=${encodeURIComponent(here)}`;
}

/** the `next` /entrar was given, if it is a path on this site */
export function nextFromEntry(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  return next ? safeNext(next) : null;
}
