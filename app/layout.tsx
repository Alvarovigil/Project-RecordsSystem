import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    // every page appends the name, so a tab is identifiable without reading it
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // icon.png / apple-icon.png / opengraph-image are picked up by convention
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // the label under the icon on iOS: the short one, always
    title: SITE_SHORT_NAME,
    // the status bar sits ON the page rather than above it, which is what
    // makes an installed app look like it owns the whole screen
    statusBarStyle: "black-translucent",
  },
  // a phone number is not a link, and iOS turning catalogue numbers blue is
  // the kind of detail that gives a web app away
  formatDetection: { telephone: false },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
};

/**
 * Being installed, not visited.
 *
 * `viewport-fit=cover` is what lets the layout reach into the notch and the
 * home indicator instead of being letterboxed between two grey bars — the
 * single setting that decides whether a page looks native on a modern phone.
 * Zoom stays available: refusing to let someone enlarge text is an
 * accessibility failure, not a polish detail, and the 16px input rule in
 * globals.css already removes the reason people disable it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body className="grain">{children}</body>
    </html>
  );
}
