import { z } from 'zod';

const FeatureFlagsSchema = z.object({
  enableThemeToggle: z.boolean().default(true),
  enableVersionUpdater: z.boolean().default(false),
  languagePriority: z.enum(['user', 'application']).default('application'),
});

const featureFlagsConfig = FeatureFlagsSchema.parse({
  enableThemeToggle: true,
  enableVersionUpdater: false,
  languagePriority: 'application',
} satisfies z.infer<typeof FeatureFlagsSchema>);

export default featureFlagsConfig;

