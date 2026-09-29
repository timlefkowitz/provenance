import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/lib/audio-denoise/**/*.test.ts',
      'src/lib/seo/**/*.test.ts',
      'src/lib/apple/**/*.test.ts',
      'src/lib/push/**/*.test.ts',
      'src/lib/capacitor/**/*.test.ts',
      'src/lib/weekly-digest.test.ts',
      'src/lib/email-preferences.test.ts',
      'src/app/mailing-list/**/*.test.ts',
      'src/lib/crm/**/*.test.ts',
      'src/lib/moderation/**/*.test.ts',
      'src/app/exhibitions/_helpers/**/*.test.ts',
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
