import { redirect } from "next/navigation";
import AppDoor from "@/components/landing/AppDoor";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { FAKE_SESSION } from "@/lib/dev-session";
import { safeNext } from "@/lib/safe-next";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar", robots: { index: false } };

/**
 * Where Colección and Perfil lead when there is nobody to show.
 *
 * Signed out, those two tabs used to open a sample shelf and a sample person
 * ("Vera Ontañón") as if they were yours — and on a phone there was no other
 * way in: the sign-in button lives in the desktop bar. Now they lead here: one
 * sentence about what an account is for, the button, and a way back to
 * looking.
 */
export default async function EnterPage(
  props: {
    searchParams: Promise<{ next?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  // already in: straight on to where they were going, if it is on this site
  const onward = safeNext(searchParams.next);
  if (FAKE_SESSION) redirect(onward);
  const supabase = await getSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (data.user) redirect(onward);

  return (
    <AppDoor
      title="Entra y empieza tu colección"
      body="Tu colección, tus racks y la gente que sigues, en el móvil y en el ordenador. Es gratis."
      browse
    />
  );
}
