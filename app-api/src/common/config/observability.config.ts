import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** OpenTelemetry / Application Insights + Azure Maps / Key Vault configuration. */
export const observabilityConfig = registerAs('observability', () => {
  const env = validateEnv(process.env);
  return {
    otelEnabled: env.OTEL_ENABLED,
    serviceName: env.OTEL_SERVICE_NAME,
    appInsightsConnectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    keyVaultUri: env.KEY_VAULT_URI,
    azureMaps: {
      clientId: env.AZURE_MAPS_CLIENT_ID,
      key: env.AZURE_MAPS_KEY,
    },
  };
});
