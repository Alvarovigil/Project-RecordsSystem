import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import ProfileView from "@/components/community/ProfileView";
import { getUserByHandle } from "@/lib/community";
import { DEMO_PROFILE } from "@/lib/demo";

export const dynamic = "force-dynamic";

/** Shared links should show who they lead to. */
export async function generateMetadata({ params }: { params: { username: string } }) {
  const supabase = getSupabaseServerClient();
  const { data } = (await supabase
    ?.from("profiles")
    .select("display_name, bio, avatar_url")
    .eq("username", params.username)
    .maybeSingle()) ?? { data: null };

  const fallback = getUserByHandle(params.username);
  const name = data?.display_name ?? fallback?.name ?? DEMO_PROFILE.displayName;
  const bio = data?.bio ?? fallback?.bio ?? DEMO_PROFILE.bio;

  return {
    title: name,
    description: bio || `La colección de vinilos de ${name}.`,
    openGraph: {
      title: `${name} en Rackr`,
      description: bio || `La colección de vinilos de ${name}.`,
      images: data?.avatar_url ? [data.avatar_url] : undefined,
    },
  };
}

/**
 * A public profile: who someone is, and what they've built.
 *
 * The server's only job here is to answer "does this handle exist, and what is
 * its id" — everything after that is one client view shared by you, by a real
 * account and by the placeholder community. There used to be a separate
 * component per case, and they had already drifted apart.
 */
export default async function ProfilePage({ params }: { params: { username: string } }) {
  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url")
      .eq("username", params.username)
      .maybeSingle();
    if (data) {
      return (
        <ProfileView
          profileId={data.id}
          initialProfile={{
            id: data.id,
            username: data.username,
            displayName: data.display_name,
            bio: data.bio,
            avatarUrl: data.avatar_url,
          }}
        />
      );
    }
  }

  // No row: either the preview collector — who lives in the visitor's browser
  // and never in a table — or someone from the placeholder community. Both are
  // real destinations, and a demo whose links 404 teaches the wrong lesson.
  if (params.username === DEMO_PROFILE.username) {
    return <ProfileView profileId={DEMO_PROFILE.id} initialProfile={DEMO_PROFILE} />;
  }
  const demo = getUserByHandle(params.username);
  if (demo) {
    return (
      <ProfileView
        profileId={demo.id}
        initialProfile={{
          id: demo.id,
          username: demo.handle,
          displayName: demo.name,
          bio: demo.bio,
          avatarUrl: null,
        }}
      />
    );
  }
  notFound();
}
