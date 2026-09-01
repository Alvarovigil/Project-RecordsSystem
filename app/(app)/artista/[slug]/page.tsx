import type { Metadata } from "next";
import ArtistView from "@/components/community/ArtistView";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const name = params.slug.replace(/-/g, " ");
  return {
    title: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `Los vinilos de ${name} en tu colección y los que te faltan.`,
  };
}

/**
 * An artist's page.
 *
 * Derived rather than stored — there is no artist table; see lib/artist. The
 * slug is the only thing in the URL, and the page resolves it against your own
 * library on the client, which is where the library lives.
 */
export default function ArtistPage({ params }: { params: { slug: string } }) {
  return <ArtistView slug={params.slug} />;
}
