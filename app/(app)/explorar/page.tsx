import { Suspense } from "react";
import ExploreView from "@/components/ExploreView";

export const metadata = {
  title: "Explorar",
  description: "Racks destacados y gente que colecciona vinilos.",
};

export default function ExplorePage() {
  // reading the query string makes this page dynamic; the boundary keeps the
  // shell rendering while it resolves
  return (
    <Suspense>
      <ExploreView />
    </Suspense>
  );
}
