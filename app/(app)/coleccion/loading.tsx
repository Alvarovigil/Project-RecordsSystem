import BootScreen from "@/components/mobile/BootScreen";

/**
 * While the server answers, the opening screen — not a black page.
 *
 * Without this the route had nothing to paint until the session check and
 * the page's own code had both arrived. Same drawing as the one the shelf
 * lifts on a cold start, so the two hand over without a cut.
 */
export default function Loading() {
  return <BootScreen />;
}
