import { Suspense } from "react";
import ExploreView from "@/components/ExploreView";
import { ExploreShell } from "@/components/explore/ExploreFrame";

export const metadata = {
  title: "Explorar",
  description: "Racks destacados y gente que colecciona vinilos.",
};

export default function ExplorePage() {
  // Reading the query string makes this boundary render on the client. What
  // the server sends in its place is the screen's frame — field, titles and
  // skeletons — and not an empty hole: on a slow phone that hole was three
  // seconds of black (F8).
  return (
    <Suspense fallback={<ExploreShell />}>
      <ExploreView />
    </Suspense>
  );
}
