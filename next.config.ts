import type { NextConfig } from "next";

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const INTERNAL_PACKAGES = [
  '@kit/ui',
  '@kit/auth',
  '@kit/accounts',
  '@kit/shared',
  '@kit/supabase',
  '@kit/i18n',
  '@kit/next',
  '@provenance/core',
  '@provenance/verification-engine',
  '@provenance/planet-artworks',
  '@provenance/planet-collectibles',
  '@provenance/planet-realestate',
  '@provenance/planet-vehicles',
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  /** Bundled server routes must resolve the ffmpeg-static native binary at runtime */
  serverExternalPackages: ['ffmpeg-static'],
  /**
   * Bundle the vendored FFmpeg copy (see scripts/ensure-ffmpeg-static.cjs). Tracing
   * pnpm's symlinked node_modules path breaks Vercel packaging ("invalid deployment package").
   */
  outputFileTracingIncludes: {
    '/api/admin/audio/denoise': ['./vendor/**/*'],
  },
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: INTERNAL_PACKAGES,
  images: {
    remotePatterns: getRemotePatterns(),
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-avatar',
      '@radix-ui/react-select',
      'date-fns',
      ...INTERNAL_PACKAGES,
    ],
  /** Increase Server Actions body size limit to handle iPhone photos (typically 3-5 MB each) */
  serverActions: {
    bodySizeLimit: '50mb', // Allow up to 50 MB for multiple high-quality photos
    },
  },
  /**
   * ignoreBuildErrors must stay true: Next.js type-check follows imports from src/ into the
   * vendored makerkit workspace packages, which have type incompatibilities with the current
   * @supabase/ssr version (__InternalSupabase conditional type). src/ itself has 0 errors
   * (verified by `tsc --noEmit --project tsconfig.json | grep "^src/"`).
   * CI diff-scoped tsc catches new errors introduced in src/ on PRs.
   */
  typescript: { ignoreBuildErrors: true },
  /** ESLint errors are caught in CI (diff-scoped); build remains unblocked while debt is cleared. */
  eslint: { ignoreDuringBuilds: true },

  /**
   * `/sitemap` (no extension) returns an HTML 404; Search Console treats that as an invalid sitemap.
   * Send crawlers and mistaken submissions to the real XML route.
   */
  async redirects() {
    return [
      { source: '/sitemap', destination: '/sitemap.xml', permanent: true },
      { source: '/sitemap/', destination: '/sitemap.xml', permanent: true },
    ];
  },

  /**
   * After deploys/rollbacks, cached HTML pointing at old _next/static chunks causes
   * Server Action ID mismatches on /portal. Discourage caching the document shell.
   */
  async headers() {
    return [
      {
        source: '/portal',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Security headers for all API routes (excluded from middleware matcher by design).
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            // API responses carry no renderable content; deny all resource loading.
            key: 'Content-Security-Policy',
            value: "default-src 'none'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

function getRemotePatterns(): { protocol: 'http' | 'https'; hostname: string }[] {
  const remotePatterns: { protocol: 'http' | 'https'; hostname: string }[] = [];

  if (SUPABASE_URL) {
    try {
      // Ensure URL has protocol
      const urlString = SUPABASE_URL.startsWith('http://') || SUPABASE_URL.startsWith('https://')
        ? SUPABASE_URL
        : `https://${SUPABASE_URL}`;
      
      const url = new URL(urlString);
      const hostname = url.hostname;

      remotePatterns.push({
        protocol: (url.protocol === 'https:' ? 'https' : 'http') as 'http' | 'https',
        hostname,
      });
    } catch (error) {
      console.warn('Invalid SUPABASE_URL in next.config.ts:', SUPABASE_URL, error);
      // Don't add invalid URL to remote patterns
    }
  }

  return IS_PRODUCTION
    ? remotePatterns
    : [
        {
          protocol: 'http' as const,
          hostname: '127.0.0.1',
        },
        {
          protocol: 'http' as const,
          hostname: 'localhost',
        },
        ...remotePatterns,
      ];
}
