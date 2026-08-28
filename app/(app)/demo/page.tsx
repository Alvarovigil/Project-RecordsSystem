import { Suspense } from "react";
import ShelfApp from "@/components/ShelfApp";

export const metadata = {
  title: "Una colección de ejemplo",
  description:
    "Treinta discos, cinco listas y la gente que los comparte. Entra, pon uno y mira cómo funciona.",
  robots: { index: false },
};

/**
 * The preview: someone else's shelf, fully playable.
 *
 * Not an empty product waiting to be filled — a collection that already means
 * something, so a visitor can understand what this is before signing up. The
 * content comes from lib/demo.ts and lives only in their browser.
 */
export default function DemoPage() {
  // The shelf reads ?lista= to open a kept list directly, and useSearchParams
  // opts a page out of static rendering unless it sits behind a boundary.
  // The boundary is cheap here: the shelf paints its own loading card anyway.
  return (
    <Suspense>
      <ShelfApp />
    </Suspense>
  );
}
