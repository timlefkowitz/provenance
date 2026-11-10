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
      'src/lib/user-roles.test.ts',
      'src/lib/institution-account.test.ts',
      'src/lib/managed-collections.test.ts',
      'src/lib/profile-questionnaire.test.ts',
      'src/app/mailing-list/**/*.test.ts',
      'src/lib/crm/**/*.test.ts',
      'src/lib/moderation/**/*.test.ts',
      'src/lib/feed/**/*.test.ts',
      'src/app/exhibitions/_helpers/**/*.test.ts',
      'src/lib/auth/safe-next-path.test.ts',
      'src/lib/image-fingerprint/**/*.test.ts',
      'src/lib/portal-graphs/**/*.test.ts',
      'src/lib/collectors/**/*.test.ts',
      'src/lib/sales/**/*.test.ts',
      'src/lib/operations/reports/**/*.test.ts',
      'src/lib/artists/**/*.test.ts',
      'src/lib/institutions/**/*.test.ts',
      'src/lib/certificate-claims/cos-approval.test.ts',
      'src/lib/scan-stats.test.ts',
      'src/lib/exhibition-scan-stats.test.ts',
      'src/lib/phone.test.ts',
      'src/lib/artwork-lists.test.ts',
      'src/lib/provenance/**/*.test.ts',
      'src/lib/valuation/provenance-value.test.ts',
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
