// @ts-nocheck
import { fileURLToPath } from 'url';
import path from 'path';

const __v0_turbopack_root = path.dirname(fileURLToPath(import.meta.url));

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

function getRemotePatterns() {
  const remotePatterns = [];

  if (SUPABASE_URL) {
    try {
      const urlString =
        SUPABASE_URL.startsWith('http://') || SUPABASE_URL.startsWith('https://')
          ? SUPABASE_URL
          : `https://${SUPABASE_URL}`;

      const url = new URL(urlString);
      remotePatterns.push({
        protocol: url.protocol === 'https:' ? 'https' : 'http',
        hostname: url.hostname,
        pathname: '/storage/v1/object/public/**',
      });
    } catch (error) {
      console.warn('Invalid SUPABASE_URL in next.config.mjs:', SUPABASE_URL, error);
    }
  }

  return IS_PRODUCTION
    ? remotePatterns
    : [
        { protocol: 'http', hostname: '127.0.0.1' },
        { protocol: 'http', hostname: 'localhost' },
        ...remotePatterns,
      ];
}

const userConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: INTERNAL_PACKAGES,
  images: {
    remotePatterns: getRemotePatterns(),
  },
  logging: {
    fetches: { fullUrl: true },
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
      bodySizeLimit: '50mb',
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
    const noStore = {
      key: 'Cache-Control',
      value: 'private, no-store, max-age=0, must-revalidate',
    };
    return [
      { source: '/portal', headers: [noStore] },
      { source: '/admin', headers: [noStore] },
      { source: '/admin/:path*', headers: [noStore] },
      /** Public feed can confuse CDNs — ensure HTML isn't swapped with stale shell when filters ship. */
      { source: '/artworks', headers: [noStore] },
      { source: '/artworks/:path*', headers: [noStore] },
    ];
  },
};

export default async function v0NextConfig() {
  return {
    ...userConfig,
    distDir: '.next',
    devIndicators: false,
    images: {
      ...userConfig.images,
      unoptimized: process.env.NODE_ENV === 'development',
    },
    logging: {
      ...userConfig.logging,
      fetches: { fullUrl: true, hmrRefreshes: true },
      browserToTerminal: true,
    },
    turbopack: {
      ...userConfig.turbopack,
      root: __v0_turbopack_root,
    },
    experimental: {
      ...userConfig.experimental,
      transitionIndicator: true,
      turbopackFileSystemCacheForDev:
        process.env.TURBOPACK_PERSISTENT_CACHE !== 'false' &&
        process.env.TURBOPACK_PERSISTENT_CACHE !== '0',
      serverActions: {
        ...userConfig.experimental?.serverActions,
        allowedOrigins: [
          ...(userConfig.experimental?.serverActions?.allowedOrigins || []),
          '*.vusercontent.net',
        ],
      },
    },
    allowedDevOrigins: [
      ...(userConfig.allowedDevOrigins || []),
      '*.vusercontent.net',
      '*.dev-vm.vusercontent.net',
    ],
  };
}
