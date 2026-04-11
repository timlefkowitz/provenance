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
  '@provenance/planet-collectibles',
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
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

  if (SUPABASE_URL) {
    try {
      const urlString = SUPABASE_URL.startsWith('http://') || SUPABASE_URL.startsWith('https://')
        ? SUPABASE_URL
        : `https://${SUPABASE_URL}`;
      const url = new URL(urlString);

      remotePatterns.push({
        protocol: url.protocol === 'https:' ? 'https' : 'http',
        hostname: url.hostname,
        pathname: '/storage/v1/object/public/**',
      });
    } catch (error) {
      console.warn('Invalid SUPABASE_URL:', SUPABASE_URL, error);
    }
  }

  return IS_PRODUCTION
    ? remotePatterns
    : [
        { protocol: 'http' as const, hostname: '127.0.0.1' },
        { protocol: 'http' as const, hostname: 'localhost' },
        ...remotePatterns,
      ];
}
