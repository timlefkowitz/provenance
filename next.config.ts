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
  productionBrowserSourceMaps: true,
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
  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

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
        source: '/admin',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

function getRemotePatterns() {
  const remotePatterns = [];

  if (SUPABASE_URL) {
    try {
      // Ensure URL has protocol
      const urlString = SUPABASE_URL.startsWith('http://') || SUPABASE_URL.startsWith('https://')
        ? SUPABASE_URL
        : `https://${SUPABASE_URL}`;
      
      const url = new URL(urlString);
      const hostname = url.hostname;

      remotePatterns.push({
        protocol: url.protocol === 'https:' ? 'https' : 'http',
        hostname,
        pathname: '/storage/v1/object/public/**',
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
          protocol: 'http',
          hostname: '127.0.0.1',
        },
        {
          protocol: 'http',
          hostname: 'localhost',
        },
        ...remotePatterns,
      ];
}
