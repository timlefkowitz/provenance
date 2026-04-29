// @ts-nocheck
// This file was auto-created and injected by v0.
// DO NOT MODIFY THIS FILE DIRECTLY.
// EDIT THE USER CONFIG IN ./next.user-config.ts INSTEAD.

import userConfigImport from './next.user-config.ts'
import { fileURLToPath } from 'url'
import path from 'path'

const __v0_turbopack_root = undefined ?? path.dirname(fileURLToPath(import.meta.url))

export default async function v0NextConfig(phase, { defaultConfig }) {
  const userConfig = typeof userConfigImport === 'function'
    ? await userConfigImport(phase, { defaultConfig })
    : userConfigImport

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
    turbopackFileSystemCacheForDev: process.env.TURBOPACK_PERSISTENT_CACHE !== 'false' && process.env.TURBOPACK_PERSISTENT_CACHE !== '0',
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
}
}
