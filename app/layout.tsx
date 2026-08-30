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
  /**
   * No `icons` override on purpose.
   *
   * There was one, pointing at `/icon.svg` — the old round mark with the
   * ornate R — and because an explicit declaration outranks the convention,
   * the tab kept showing it long after `app/icon.png` became the square
   * wordmark that sits on every home screen. The icon in a tab and the icon on
   * a phone have to be the same object; two marks for one product is how a
   * brand stops being recognised.
   *
   * icon.png / apple-icon.png / opengraph-image are picked up by convention.
   */
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
  /**
   * No pinch zoom.
   *
   * Reversing an earlier decision, and worth saying why both ways. Refusing to
   * let somebody enlarge text is a real cost, and on a page it would be the
   * wrong trade. This is not a page: installed, it is the only app on the
   * phone whose content can be pinched, and the gesture collides with
   * everything the shelf is made of — a stack you drag, sleeves you flick, a
   * scroll that snaps. A pinch that half-zooms the interface and leaves it
   * there is a broken app, and the way back out is not obvious to anyone.
   *
   * Safari ignores this in a browser tab and honours it in a standalone
   * window, which is exactly the split we want: the web page stays zoomable,
   * the installed app does not. `touch-action: manipulation` in globals.css
   * kills the double-tap zoom that this flag does not cover.
   */
  maximumScale: 1,
  userScalable: false,
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
