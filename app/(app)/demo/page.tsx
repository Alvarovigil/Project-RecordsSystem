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
  return <ShelfApp />;
}
