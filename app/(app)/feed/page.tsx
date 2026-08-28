import { redirect } from "next/navigation";

/**
 * "Feed" was a name that described the mechanism, not the thing. The screen is
 * called Actividad now; the old address keeps working because links to it are
 * out in the world and a dead URL is a worse answer than a redirect.
 */
export default function FeedPage() {
  redirect("/actividad");
}
