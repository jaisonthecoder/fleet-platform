import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/**
 * Compliance eligibility-gate toggles. These gate **optional** requirements; the
 * structural hard blocks (expired documents, active block, inactive employment)
 * are always enforced and are never toggleable.
 */
export const complianceConfig = registerAs('compliance', () => {
  const env = validateEnv(process.env);
  return {
    /** Fail-close booking when the driver has no licence on file. */
    licenceMissingBlock: env.LICENCE_MISSING_BLOCK,
  };
});
