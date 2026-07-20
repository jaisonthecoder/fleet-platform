import { z } from 'zod';

/** Deployment environments recognised by the platform. */
export const NODE_ENVS = [
  'local',
  'development',
  'test',
  'uat',
  'production',
] as const;

/** Parses truthy environment strings ("1"/"true"/"yes"/"on") into booleans. */
const boolFromEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
  }, z.boolean());

/**
 * The single source of truth for every environment variable the backend reads.
 * All infrastructure values are optional with safe defaults so the application
 * boots for local development and tests without external services attached.
 */
export const envSchema = z.object({
  // Runtime & reusability seam (ADR-008 dormant organization_id default)
  NODE_ENV: z.enum(NODE_ENVS).default('local'),
  DATA_REGION: z.string().default('uae-north'),
  ORGANIZATION_ID: z
    .string()
    .default('00000000-0000-0000-0000-000000000ad0'),

  // API deployable
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_GLOBAL_PREFIX: z.string().default('api'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // PDP deployable + budgets
  PDP_PORT: z.coerce.number().int().positive().default(3001),
  PDP_URL: z.string().default('http://localhost:3001'),
  PDP_LATENCY_BUDGET_MS: z.coerce.number().int().positive().default(200),
  ELIGIBILITY_LATENCY_BUDGET_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(500),

  // Logging
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  LOG_PRETTY: boolFromEnv(false),

  // PostgreSQL + TimescaleDB
  DATABASE_URL: z
    .string()
    .default('postgres://fleet:fleet@localhost:5432/fleet'),
  DATABASE_SSL: boolFromEnv(false),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),

  // Redis (PDP/eligibility cache, BullMQ, Socket.IO adapter)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_TLS: boolFromEnv(false),

  // Azure Service Bus (reliable domain events)
  SERVICE_BUS_CONNECTION_STRING: z.string().optional(),
  SERVICE_BUS_TOPIC: z.string().default('domain-events'),

  // Transactional outbox dispatcher (at-least-once publish + DLQ)
  OUTBOX_DISPATCH_ENABLED: boolFromEnv(false),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(8),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(100),

  // Azure Event Hubs (telemetry ingress)
  EVENT_HUBS_CONNECTION_STRING: z.string().optional(),
  EVENT_HUB_NAME: z.string().default('telemetry'),
  EVENT_HUBS_CONSUMER_GROUP: z.string().default('ingest'),

  // Azure Blob Storage (documents, photos, signatures, consent WORM)
  STORAGE_CONNECTION_STRING: z.string().optional(),
  STORAGE_CONTAINER_DOCUMENTS: z.string().default('vehicle-docs'),
  STORAGE_CONTAINER_CONSENT: z.string().default('consent-records'),
  STORAGE_CONTAINER_CHECKPOINTS: z.string().default('eventhub-checkpoints'),

  // Microsoft Entra ID (OIDC/JWT)
  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_API_CLIENT_ID: z.string().optional(),
  ENTRA_API_AUDIENCE: z.string().optional(),
  ENTRA_ISSUER: z.string().optional(),

  // Dev-login stand-in (P0-R2-4): usable only in lower environments. Structurally
  // forced OFF in uat/production regardless of this flag (see identity.config).
  AUTH_DEV_LOGIN: boolFromEnv(true),

  // Azure Key Vault + Azure Maps
  KEY_VAULT_URI: z.string().optional(),
  AZURE_MAPS_CLIENT_ID: z.string().optional(),
  AZURE_MAPS_KEY: z.string().optional(),

  // Observability (OpenTelemetry -> Application Insights)
  OTEL_ENABLED: boolFromEnv(false),
  OTEL_SERVICE_NAME: z.string().default('fleet-api'),
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),

  // Telematics ingest
  TELEMETRY_SOURCE: z
    .enum(['simulator', 'aggregator', 'direct'])
    .default('simulator'),
  SIMULATOR_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  SIMULATOR_DEVICE_COUNT: z.coerce.number().int().positive().default(50),

  // OpenAPI / Swagger
  SWAGGER_ENABLED: boolFromEnv(true),
  SWAGGER_PATH: z.string().default('api-docs'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates raw environment variables against {@link envSchema}, throwing a
 * single readable error listing every invalid key. Used by ConfigModule.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
