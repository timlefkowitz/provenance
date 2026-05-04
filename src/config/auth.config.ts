import type { Provider } from '@supabase/supabase-js';
import { z } from 'zod';

const providers: z.ZodType<Provider> = getProviders();

const AuthConfigSchema = z.object({
  captchaTokenSiteKey: z.string().optional(),
  displayTermsCheckbox: z.boolean().optional(),
  providers: z.object({
    password: z.boolean(),
    magicLink: z.boolean(),
    oAuth: providers.array(),
  }),
});

// Auth providers are enabled by default. To explicitly disable one, set the
// corresponding env var to "false" (e.g. NEXT_PUBLIC_AUTH_MAGIC_LINK=false).
// This keeps configuration simple: the defaults Just Work in dev and prod
// without requiring extra env vars.
const passwordEnabled = process.env.NEXT_PUBLIC_AUTH_PASSWORD !== 'false';
const magicLinkEnabled = process.env.NEXT_PUBLIC_AUTH_MAGIC_LINK !== 'false';

console.log('[Auth] providers configured', {
  password: passwordEnabled,
  magicLink: magicLinkEnabled,
  oAuth: ['google'],
});

const authConfig = AuthConfigSchema.parse({
  captchaTokenSiteKey: process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY,
  displayTermsCheckbox: false,
  providers: {
    password: passwordEnabled,
    magicLink: magicLinkEnabled,
    oAuth: ['google'],
  },
} satisfies z.infer<typeof AuthConfigSchema>);

export default authConfig;

function getProviders() {
  return z.enum([
    'apple', 'azure', 'bitbucket', 'discord', 'facebook', 'figma', 'github',
    'gitlab', 'google', 'kakao', 'keycloak', 'linkedin', 'linkedin_oidc',
    'notion', 'slack', 'spotify', 'twitch', 'twitter', 'workos', 'zoom', 'fly',
  ]);
}

