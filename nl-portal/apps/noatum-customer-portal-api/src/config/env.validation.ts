import { z } from 'zod';

/**
 * Fail fast at boot rather than at the first request. A missing connection string or
 * Entra setting is a deployment fault, not a runtime condition to handle.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(43000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),

  ENTRA_TENANT_ID: z.string().uuid(),
  ENTRA_API_CLIENT_ID: z.string().uuid(),
  ENTRA_API_AUDIENCE: z.string().min(1),
  /** Optional: both tenant issuer spellings are derived from ENTRA_TENANT_ID. */
  ENTRA_ISSUER: z.string().url().optional(),

  /**
   * Who may self-register on first sign-in. Comma separated email domains; empty
   * means any identity the trusted tenant issued (D-01 interim).
   */
  STAFF_EMAIL_DOMAINS: z.string().default(''),
  /** Emails or object ids that always resolve to Platform Admin (FR-IAM-004). */
  PLATFORM_BOOTSTRAP_ADMINS: z.string().default(''),
  /** Local-only "act as" header bypass. Refused in production below. */
  DEV_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
  /** Lets the header sign-in run where NODE_ENV is production, for demonstration sites. */
  DEV_AUTH_ALLOW_IN_PRODUCTION: z.enum(['true', 'false']).default('false'),
  /** Comma-separated staff addresses that may sign in without a second factor. */
  DEMO_STAFF_ACCOUNTS: z.string().optional(),

  // Portal-managed password sign-in (ADR-006). Off unless explicitly enabled.
  LOCAL_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
  LOCAL_AUTH_SESSION_SECRET: z.string().optional(),
  LOCAL_AUTH_COOKIE_NAME: z.string().min(1).default('noatum.sid'),
  LOCAL_AUTH_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  LOCAL_AUTH_IDLE_MINUTES: z.coerce.number().int().positive().max(1440).default(30),
  LOCAL_AUTH_ABSOLUTE_HOURS: z.coerce.number().int().positive().max(720).default(8),
  LOCAL_AUTH_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  LOCAL_AUTH_MFA_KEY: z.string().optional(),
  /** Proxy hops to trust. Never a boolean: see the note in main.ts. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  CW1_EADAPTER_URL: z.string().url(),
  CW1_RATE_URL: z.string().url(),
  CW1_ORG_EXPORT_URL: z.string().url().optional(),
  CW1_SOURCE_INSTANCE: z.string().min(1).max(40).default('unassigned'),
  CW1_USERNAME: z.string().min(1),
  CW1_PASSWORD: z.string().min(1),

  // Optional until the Azure Communication Services resource is provisioned.
  AZURE_COMMUNICATION_CONNECTION_STRING: z.string().optional(),
  AZURE_COMMUNICATION_SENDER: z.string().email().optional(),
  PORTAL_BASE_URL: z.string().url().optional(),
  CW1_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  INTEGRATION_RETAIN_MESSAGE_DAYS: z.coerce.number().int().min(1).default(395),

  // `none` is first-class: the platform must run fully with every family unset.
  CW1_TRANSPORT_QUOTE: z.enum(['none', 'http', 'soap', 'file', 'middleware']).default('none'),
  CW1_TRANSPORT_SHIPMENT: z.enum(['none', 'http', 'soap', 'file', 'middleware']).default('none'),
  CW1_TRANSPORT_BOOKING: z.enum(['none', 'http', 'soap', 'file', 'middleware']).default('none'),
  CW1_TRANSPORT_DOCUMENT: z.enum(['none', 'http', 'soap', 'file', 'middleware']).default('none'),
  CW1_TRANSPORT_FINANCE: z.enum(['none', 'http', 'soap', 'file', 'middleware']).default('none'),
  CW1_TRANSPORT_ORGANISATION: z.enum(['none', 'http', 'soap', 'file', 'middleware']).default('none'),

  JOBS_ENABLED: z.enum(['true', 'false']).default('true'),
  JOBS_SCHEMA: z.string().default('pgboss'),

  CORS_ORIGINS: z.string().default('http://localhost:45173'),

  /** Where uploaded files go. `local` is development only; refused in production below. */
  STORAGE_DRIVER: z.enum(['local', 'azure-blob']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('.local-storage'),
  STORAGE_CONTAINER: z.string().min(1).default('noatum-quote-documents'),
  STORAGE_ACCOUNT_NAME: z.string().optional(),
  /** Bytes. 20 MB covers a scanned safety data sheet without inviting a video. */
  STORAGE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && env.DEV_AUTH_ENABLED === 'true' && env.DEV_AUTH_ALLOW_IN_PRODUCTION !== 'true') {
    ctx.addIssue({
      code: 'custom',
      path: ['DEV_AUTH_ENABLED'],
      message:
        'The development sign-in bypass cannot be enabled in production. A demonstration site that genuinely wants it must also set DEV_AUTH_ALLOW_IN_PRODUCTION, and must not hold real data.',
    });
  }

  // Local disk in production is silent data loss: App Service storage is
  // per-instance and ephemeral, so an uploaded document survives until the next
  // restart and is invisible to every other instance meanwhile.
  if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local') {
    ctx.addIssue({
      code: 'custom',
      path: ['STORAGE_DRIVER'],
      message: 'Local disk storage cannot be used in production. Configure azure-blob.',
    });
  }

  if (env.STORAGE_DRIVER === 'azure-blob' && !env.STORAGE_ACCOUNT_NAME) {
    ctx.addIssue({
      code: 'custom',
      path: ['STORAGE_ACCOUNT_NAME'],
      message: 'STORAGE_ACCOUNT_NAME is required when the storage driver is azure-blob.',
    });
  }

  if (env.LOCAL_AUTH_ENABLED === 'true') {
    // Signing keys 32 bytes and over; a short one makes the cookie signature guessable.
    if (!env.LOCAL_AUTH_SESSION_SECRET || env.LOCAL_AUTH_SESSION_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['LOCAL_AUTH_SESSION_SECRET'],
        message: 'Local sign-in needs a session secret of at least 32 characters.',
      });
    }

    if (env.NODE_ENV === 'production' && env.LOCAL_AUTH_COOKIE_SECURE === 'false') {
      ctx.addIssue({
        code: 'custom',
        path: ['LOCAL_AUTH_COOKIE_SECURE'],
        message: 'Session cookies cannot be sent over plain http in production.',
      });
    }

    // 32 raw bytes for AES-256-GCM. Checked here rather than at first enrolment, so a
    // missing key fails deployment instead of the first person to set up a phone.
    const mfaKey = Buffer.from(env.LOCAL_AUTH_MFA_KEY ?? '', 'base64');
    if (mfaKey.length !== 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['LOCAL_AUTH_MFA_KEY'],
        message: 'Local sign-in needs a 32-byte base64 key to encrypt second-factor secrets.',
      });
    }

    if (env.LOCAL_AUTH_COOKIE_SAMESITE === 'none' && env.LOCAL_AUTH_COOKIE_SECURE === 'false') {
      ctx.addIssue({
        code: 'custom',
        path: ['LOCAL_AUTH_COOKIE_SAMESITE'],
        message: 'SameSite=none is only valid on a secure cookie; browsers drop it otherwise.',
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}
