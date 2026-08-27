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
