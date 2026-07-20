import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** Telematics ingest source selection and simulator tuning. */
export const telematicsConfig = registerAs('telematics', () => {
  const env = validateEnv(process.env);
  return {
    source: env.TELEMETRY_SOURCE,
    simulatorIntervalMs: env.SIMULATOR_INTERVAL_MS,
    simulatorDeviceCount: env.SIMULATOR_DEVICE_COUNT,
  };
});
