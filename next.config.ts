import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  // libSQL ships native bindings for local files: keep the driver out of the bundler.
  serverExternalPackages: ["@libsql/client", "libsql", "@prisma/adapter-libsql"],
  poweredByHeader: false,
  async headers() {
    const production = process.env.NODE_ENV === "production";
    return [
      {
        source: "/:path*",
        headers: production
          ? [...securityHeaders, { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
          : securityHeaders,
      },
    ];
  },
};

export default nextConfig;
