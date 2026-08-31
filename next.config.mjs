/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "i.discogs.com" },
      { protocol: "https", hostname: "img.discogs.com" },
    ],
  },
  transpilePackages: ["three"],

  /**
   * A build can be told to write somewhere else.
   *
   * Verifying a change with a production build while `next dev` is running
   * means both processes writing the same `.next` — and the loser is the dev
   * server, which ends up serving chunks that no longer exist ("Cannot find
   * module './1682.js'") or hanging mid-compile with a corrupt webpack cache.
   * Vercel and `npm run build` are untouched; this only gives a throwaway
   * verification build somewhere private to go.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  /**
   * One canonical origin, always.
   *
   * With www and the apex both serving the app, the same person can be on two
   * different origins without noticing — and a browser keeps their cookies
   * apart. Sign-in breaks on exactly that: the PKCE verifier is written on the
   * origin where you pressed the button and read on the origin Supabase sends
   * you back to. Different host, no cookie, "code verifier not found".
   *
   * A redirect, not a rewrite: a rewrite would keep two live addresses and the
   * bug with them. This collapses www into the apex before anything is stored.
   */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.rackr.club" }],
        destination: "https://rackr.club/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
