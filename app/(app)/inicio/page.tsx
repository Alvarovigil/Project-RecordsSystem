import { redirect } from "next/navigation";

/**
 * The old social home, kept only as a signpost.
 *
 * A digest of the feed and of explore was a lobby: a page you crossed on the
 * way to the thing you came for. The thing you came for is the shelf, so that
 * is where the door opens now. Old links and bookmarks still land somewhere.
 */
export default function InicioPage() {
  redirect("/coleccion");
}
