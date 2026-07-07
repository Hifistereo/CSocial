import type { NextConfig } from "next";

// CSP: the only external surfaces are the YouTube IFrame API script, the
// privacy-enhanced embed frame, and thumbnail images. Everything else is
// same-origin. 'unsafe-inline'/'unsafe-eval' in script-src are required by
// Next.js hydration (and dev tooling); tighten with nonces post-pilot.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://i.ytimg.com https://*.ytimg.com",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
