import { Suspense } from "react";
import ShelfApp from "@/components/ShelfApp";
import BootScreen from "@/components/mobile/BootScreen";
import DemoBand from "@/components/DemoBand";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Una colección de ejemplo",
  description:
    "Treinta discos, cinco racks y la gente que los comparte. Entra, pon uno y mira cómo funciona.",
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
  // That boundary is also what the server sends as HTML for this static page,
  // so its fallback is the opening screen: an empty one was a black page for
  // as long as the shelf's code took to arrive.
  return (
    <>
      {/* se entra escribiendo la dirección: que se sepa que no es tuya (F5).
          Sin cuentas en este sitio, la estantería sí es tuya y no hay banda */}
      {isSupabaseConfigured && <DemoBand />}
      <Suspense fallback={<BootScreen />}>
        <ShelfApp />
      </Suspense>
    </>
  );
}
