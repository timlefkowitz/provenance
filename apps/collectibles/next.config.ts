import type { NextConfig } from "next";

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Legacy/default Supabase project domain. Kept in addition to whatever
// NEXT_PUBLIC_SUPABASE_URL currently points to (e.g. a custom auth domain
// like auth.provenance.guru) so that already-stored image URLs generated
// against the raw *.supabase.co domain don't break in next/image.
const LEGACY_SUPABASE_HOSTNAME = 'upbiqtluqemrmonyghix.supabase.co';

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
  '@provenance/planet-collectibles',
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: INTERNAL_PACKAGES,
  images: {
    remotePatterns: getRemotePatterns(),
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      ...INTERNAL_PACKAGES,
    ],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

function getRemotePatterns() {
  const remotePatterns: { protocol: 'http' | 'https'; hostname: string; pathname?: string }[] = [];
  const seenHostnames = new Set<string>();

  function addHostname(hostname: string, protocol: 'http' | 'https') {
    if (seenHostnames.has(hostname)) return;
    seenHostnames.add(hostname);
    remotePatterns.push({ protocol, hostname, pathname: '/storage/v1/object/public/**' });
  }

  if (SUPABASE_URL) {
    try {
      const urlString = SUPABASE_URL.startsWith('http://') || SUPABASE_URL.startsWith('https://')
        ? SUPABASE_URL
        : `https://${SUPABASE_URL}`;
      const url = new URL(urlString);

      addHostname(url.hostname, url.protocol === 'https:' ? 'https' : 'http');
    } catch (error) {
      console.warn('Invalid SUPABASE_URL:', SUPABASE_URL, error);
    }
  }

  addHostname(LEGACY_SUPABASE_HOSTNAME, 'https');

  return IS_PRODUCTION
    ? remotePatterns
    : [
        { protocol: 'http' as const, hostname: '127.0.0.1' },
        { protocol: 'http' as const, hostname: 'localhost' },
        ...remotePatterns,
      ];
}
