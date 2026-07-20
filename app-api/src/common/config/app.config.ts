import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** Application-wide runtime configuration (ports, prefix, CORS, org seam). */
export const appConfig = registerAs('app', () => {
  const env = validateEnv(process.env);
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    dataRegion: env.DATA_REGION,
    organizationId: env.ORGANIZATION_ID,
    apiPort: env.API_PORT,
    globalPrefix: env.API_GLOBAL_PREFIX,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    pdpPort: env.PDP_PORT,
    pdpUrl: env.PDP_URL,
    pdpLatencyBudgetMs: env.PDP_LATENCY_BUDGET_MS,
    eligibilityLatencyBudgetMs: env.ELIGIBILITY_LATENCY_BUDGET_MS,
  };
});
