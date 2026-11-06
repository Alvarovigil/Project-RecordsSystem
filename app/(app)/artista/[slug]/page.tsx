import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArtistView from "@/components/community/ArtistView";
import { resolveArtistVerdict } from "@/lib/artist-known-server";

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
 *
 * Antes de eso, una sola pregunta en el servidor: ¿hay alguien con este
 * nombre? Si ni el catálogo ni la base lo conocen, 404 — una dirección
 * inventada ya no fabrica un artista. Ante un límite o una duda, la página
 * sale como siempre (lib/artist-known-server).
 */
export default async function ArtistPage({ params }: { params: { slug: string } }) {
  let slug = params.slug;
  try {
    slug = decodeURIComponent(params.slug);
  } catch {
    /* un % suelto: se pregunta tal cual */
  }
  if ((await resolveArtistVerdict(slug)) === "unknown") notFound();
  return <ArtistView slug={params.slug} />;
}
