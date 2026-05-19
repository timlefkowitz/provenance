import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/lib/audio-denoise/**/*.test.ts',
      'src/lib/seo/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/lib/seo/__mocks__/server-only.ts'),
    },
  },
});
