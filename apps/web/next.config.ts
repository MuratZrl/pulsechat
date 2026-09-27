import type { NextConfig } from "next";
import path from "path";

// Origins the app talks to, from the build-time env so the CSP follows the
// deployment: the API for fetches, the socket server for WebSocket + polling.
function originOf(url: string | undefined, fallback: string): string {
  try {
    return new URL(url ?? fallback).origin;
  } catch {
    return new URL(fallback).origin;
  }
}
const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL, "http://localhost:3001/api");
const socketOrigin = originOf(process.env.NEXT_PUBLIC_SOCKET_URL, "http://localhost:3001");
const socketWsOrigin = socketOrigin.replace(/^http/, "ws");
const isDev = process.env.NODE_ENV !== "production";

// Basic CSP. Scripts and styles still need 'unsafe-inline': Next's hydration
// payload and the theme bootstrap script in layout.tsx are inline, and a
// nonce-based policy would force every page to render dynamically. Images
// and audio come from R2 (public avatars, signed attachment URLs) and GIPHY,
// hence https:. Dev adds eval (React Refresh) and plain http/ws for local
// servers.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${isDev ? " http:" : ""}`,
  `media-src 'self' blob: https:${isDev ? " http:" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${socketOrigin} ${socketWsOrigin} https://api.giphy.com${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
