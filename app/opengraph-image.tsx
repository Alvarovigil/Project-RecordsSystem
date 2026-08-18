import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const runtime = "edge";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card people actually see when a link is shared. Built here rather than
 * shipped as a file so it can't drift from the product's own language.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#f5f3ef",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: "#F83A23",
            }}
          />
          <span
            style={{
              fontSize: 24,
              letterSpacing: 6,
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            Rackr
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>
            Los discos que tienes,
          </span>
          <span style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2, opacity: 0.55 }}>
            y quién más los tiene
          </span>
        </div>

        <span style={{ fontSize: 26, opacity: 0.45 }}>
          Colecciones de vinilos · listas · comunidad
        </span>
      </div>
    ),
    size,
  );
}
