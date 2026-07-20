import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** Azure Service Bus (domain events) and Event Hubs (telemetry) configuration. */
export const messagingConfig = registerAs('messaging', () => {
  const env = validateEnv(process.env);
  return {
    serviceBus: {
      connectionString: env.SERVICE_BUS_CONNECTION_STRING,
      topic: env.SERVICE_BUS_TOPIC,
    },
    eventHubs: {
      connectionString: env.EVENT_HUBS_CONNECTION_STRING,
      eventHubName: env.EVENT_HUB_NAME,
      consumerGroup: env.EVENT_HUBS_CONSUMER_GROUP,
    },
    outbox: {
      dispatchEnabled: env.OUTBOX_DISPATCH_ENABLED,
      pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
      maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
      batchSize: env.OUTBOX_BATCH_SIZE,
    },
  };
});
