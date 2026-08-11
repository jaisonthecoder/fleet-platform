import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/**
 * HCM (Oracle Fusion) person sync + eligibility data-freshness configuration.
 *
 * HCM is an **optional accelerator**, never a hard dependency. When it is
 * disabled the platform runs entirely on manually-maintained person data and
 * the eligibility freshness ("data as of") gate is **skipped** — only the
 * structural hard blocks (expired/missing licence, expired vehicle documents,
 * active access block, inactive employment, non-bookable vehicle) still apply.
 * When it is enabled, person data older than the SLA blocks + escalates.
 */
export const hcmConfig = registerAs('hcm', () => {
  const env = validateEnv(process.env);
  return {
    /** Whether the HCM person feed is connected/authoritative in this environment. */
    enabled: env.HCM_ENABLED,
    /** Minutes after which HCM-synced person data is considered stale (gate blocks). */
    freshnessSlaMinutes: env.HCM_FRESHNESS_SLA_MINUTES,
  };
});
