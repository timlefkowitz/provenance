import { z } from 'zod';

const AppConfigSchema = z.object({
    name: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    url: z.string().url(),
    locale: z.string().default('en'),
    theme: z.enum(['light', 'dark', 'system']),
    themeColor: z.string(),
    themeColorDark: z.string(),
});

const appConfig = AppConfigSchema.parse({
  name: 'Provenance',
  title: 'Provenance - Digital Collectibles',
  description: 'Marketplace for digital collectibles and art.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  locale: 'en',
  theme: 'light',
  themeColor: '#ffffff',
  themeColorDark: '#000000',
});

export default appConfig;

