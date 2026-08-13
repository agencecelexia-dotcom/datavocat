import type { NextConfig } from "next";

/**
 * En-têtes de sécurité.
 *
 * L'application manipule des descriptions d'affaires couvertes par le secret
 * professionnel et rend du markdown produit par un modèle. `format-markdown.ts`
 * échappe correctement le HTML en amont, mais une CSP fournit la défense en
 * profondeur qui manquait entièrement.
 *
 * Note sur `unsafe-inline` / `unsafe-eval` dans `script-src` : Next.js injecte
 * des scripts inline pour l'hydratation. Les retirer suppose de passer par une
 * CSP à nonce, ce qui impose de générer les en-têtes dans le middleware. À
 * envisager ensuite ; en l'état, la CSP ferme déjà les vecteurs principaux
 * (origines externes, iframes, form-action, base-uri).
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      // Supabase (REST + Realtime) et l'API Anthropic côté serveur uniquement.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
