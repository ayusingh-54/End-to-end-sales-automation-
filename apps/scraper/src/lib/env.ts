import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  APOLLO_API_KEY: z.string().min(1).optional(),
  APOLLO_DAILY_QUOTA: z.coerce.number().int().positive().default(500),

  ZEROBOUNCE_API_KEY: z.string().min(1).optional(),

  LINKEDIN_AGENT_URL: z.string().url().optional(),
  LINKEDIN_AGENT_API_KEY: z.string().min(1).optional(),

  FIRECRAWL_API_KEY: z.string().min(1).optional(),
  SCRAPER_USER_AGENT: z.string().default('LWL-LeadBot/1.0 (+https://learnwithleaders.com/bot)'),
});

export type Env = z.infer<typeof Env>;

export function loadEnv(): Env {
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}
