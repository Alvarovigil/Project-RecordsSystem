import { ShelfLoading } from "@/components/mobile/BootScreen";

/**
 * While the server answers: the opening screen on a cold start — not a black
 * page — and the shelf's own dark ground on a navigation, never the mark.
 *
 * Without this the route had nothing to paint until the session check and
 * the page's own code had both arrived. On a cold start it is the same
 * drawing the shelf lifts, so the two hand over without a cut.
 */
export default function Loading() {
  return <ShelfLoading path="/coleccion" />;
}
