/**
 * Signed in as nobody in particular.
 *
 * Building the logged-in interface shouldn't require a Google round trip and a
 * real row in Supabase. With NEXT_PUBLIC_FAKE_SESSION=1 the app treats you as
 * the placeholder collector from lib/demo.ts: every signed-in surface opens,
 * while the data underneath stays on the local backend, so nothing you click
 * touches the database.
 *
 * Development only, on purpose — the flag is inert in a production build, so a
 * stray env var can never hand a visitor someone else's session.
 */
import type { User } from "@supabase/supabase-js";
import { DEMO_PROFILE } from "@/lib/demo";

export const FAKE_SESSION =
  process.env.NEXT_PUBLIC_FAKE_SESSION === "1" &&
  process.env.NODE_ENV !== "production";

/** Enough of a user for the interface; none of it is real. */
export const FAKE_USER = {
  id: DEMO_PROFILE.id,
  email: `${DEMO_PROFILE.username}@example.test`,
  app_metadata: {},
  user_metadata: { full_name: DEMO_PROFILE.displayName },
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00.000Z",
} as User;
