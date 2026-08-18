import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Public pages are meant to be found; private surfaces are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/ajustes", "/coleccion", "/demo", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
