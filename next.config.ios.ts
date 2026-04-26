/**
 * Next.js Configuration for iOS App (Static Export)
 * 
 * This configuration is used when building for Capacitor/iOS.
 * It enables static export mode which is required for native app bundling.
 * 
 * Usage: NEXT_CONFIG=ios next build
 */

import type { NextConfig } from "next";

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
  // Enable static export for Capacitor
  output: 'export',
  
  // Disable image optimization (not available in static export)
  images: {
    unoptimized: true,
    remotePatterns: getRemotePatterns(),
  },
  
  // Trailing slashes help with static file routing
  trailingSlash: true,
  
  reactStrictMode: true,
  
  transpilePackages: INTERNAL_PACKAGES,
  
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-avatar',
      '@radix-ui/react-select',
      'date-fns',
      ...INTERNAL_PACKAGES,
    ],
  },
  
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  
  // Environment variables for the native app
  env: {
    NEXT_PUBLIC_IS_NATIVE_APP: 'true',
  },
};

export default nextConfig;

function getRemotePatterns() {
  const remotePatterns = [];

  if (SUPABASE_URL) {
    try {
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
      console.warn('Invalid SUPABASE_URL:', error);
    }
  }

  return remotePatterns;
}
