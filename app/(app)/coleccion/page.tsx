import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import ShelfApp from "@/components/ShelfApp";
import { FAKE_SESSION } from "@/lib/dev-session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Tu colección",
  // your own shelf is nobody else's business
  robots: { index: false },
};

/** Your own shelf. Without a session there is nothing here to show. */
export default async function ShelfPage() {
  // the fake session browses the placeholder shelf, not a Supabase one
  if (!isSupabaseConfigured || FAKE_SESSION) return <ShelfApp />;

  const supabase = getSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!data.user) redirect("/");

  return <ShelfApp authenticated />;
}
