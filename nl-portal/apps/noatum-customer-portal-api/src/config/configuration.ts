/**
 * Typed configuration, assembled once at boot.
 *
 * Secrets never live here as literals - they arrive as environment variables that the
 * pipelines populate from Key Vault backed variable groups.
 */

/** Splits a comma or whitespace separated env list into trimmed, lowercased entries. */
function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export const configuration = () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 43000),
  logLevel: process.env.LOG_LEVEL ?? 'info',

  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:45173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  database: {
    url: process.env.DATABASE_URL ?? '',
    /** Owner-role URL. Used by the pipeline migration step only, never by the running app. */
    migrationUrl: process.env.DATABASE_MIGRATION_URL ?? '',
  },

  entra: {
    tenantId: process.env.ENTRA_TENANT_ID ?? '',
    apiClientId: process.env.ENTRA_API_CLIENT_ID ?? '',
    audience: process.env.ENTRA_API_AUDIENCE ?? '',
    issuer: process.env.ENTRA_ISSUER ?? '',
    get jwksUri(): string {
      return `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`;
    },
  },

  identity: {
    /** Empty means any identity from the trusted tenant may register (D-01 interim). */
    staffEmailDomains: splitList(process.env.STAFF_EMAIL_DOMAINS),
    /** Matched against the token email and subject, both lowercased. */
    bootstrapAdmins: splitList(process.env.PLATFORM_BOOTSTRAP_ADMINS),
    /**
     * The demonstration sign-in picker. It trusts a header, so it is off unless asked
     * for twice: once by DEV_AUTH_ENABLED, and again - outside development - by
     * DEV_AUTH_ALLOW_IN_PRODUCTION, which exists so no deployment can inherit it by
     * accident. Where it is on, AuthGuard narrows it to the seeded `dev-` accounts.
     */
    devAuthEnabled:
      process.env.DEV_AUTH_ENABLED === 'true' &&
      (process.env.NODE_ENV !== 'production' || process.env.DEV_AUTH_ALLOW_IN_PRODUCTION === 'true'),
  },

  /**
   * Portal-managed password sign-in for invited customers and the bootstrap
   * administrator (ADR-006). Off unless switched on: with `enabled` false the module
   * registers no routes and asks for no secrets, and staff SSO is unaffected.
   */
  localAuth: {
    enabled: process.env.LOCAL_AUTH_ENABLED === 'true',
    sessionSecret: process.env.LOCAL_AUTH_SESSION_SECRET ?? '',
    cookieName: process.env.LOCAL_AUTH_COOKIE_NAME ?? 'noatum.sid',
    /** Only a deliberate opt-out for plain-http localhost; production forces it on. */
    cookieSecure:
      process.env.NODE_ENV === 'production' || process.env.LOCAL_AUTH_COOKIE_SECURE === 'true',
    idleMinutes: Number(process.env.LOCAL_AUTH_IDLE_MINUTES ?? 30),
    absoluteHours: Number(process.env.LOCAL_AUTH_ABSOLUTE_HOURS ?? 8),
    /**
     * 'none' is only correct when the SPA is served from a different site to the API,
     * and then only with Secure. Anything else should stay 'lax'.
     */
    cookieSameSite: (['lax', 'strict', 'none'] as const).includes(
      process.env.LOCAL_AUTH_COOKIE_SAMESITE as 'lax' | 'strict' | 'none',
    )
      ? (process.env.LOCAL_AUTH_COOKIE_SAMESITE as 'lax' | 'strict' | 'none')
      : ('lax' as const),
    /** Base64 32-byte key for TOTP secrets. Held outside the database (PA-04). */
    mfaEncryptionKey: process.env.LOCAL_AUTH_MFA_KEY ?? '',
    /**
     * Staff addresses allowed to sign in with a password alone, for demonstration
     * environments where handing every fictional account an authenticator app is not
     * worth it. Empty - the default - means every internal account must enrol a second
     * factor, which is the rule everywhere real work happens.
     *
     * It exempts nobody from having a password, and a listed account that HAS enrolled
     * a factor is still asked for it. Never list a real person.
     */
    passwordOnlyStaff: splitList(process.env.DEMO_STAFF_ACCOUNTS).map((value) => value.toLowerCase()),
  },

  /**
   * How many proxy hops to trust for the client address. Without this the secure
   * cookie is never issued behind a load balancer, and the per-address rate limiter
   * sees one address for every customer. Zero means the API is exposed directly.
   */
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),

  integration: {
    /**
     * How long an integration message keeps its payload. Thirteen months, matching
     * the PRD's raw-message retention. After this the payload is blanked and the
     * operational record of the exchange is kept.
     */
    retainMessageDays: Number(process.env.INTEGRATION_RETAIN_MESSAGE_DAYS ?? 395),
  },

  cw1: {
    eadapterUrl: process.env.CW1_EADAPTER_URL ?? '',
    rateUrl: process.env.CW1_RATE_URL ?? '',
    /** Base URL serving the organisation export. The simulator locally, CW1 later. */
    organisationExportUrl: process.env.CW1_ORG_EXPORT_URL ?? '',
    /** Which CargoWise database these codes belong to; part of the organisation key. */
    sourceInstance: process.env.CW1_SOURCE_INSTANCE ?? 'unassigned',
    username: process.env.CW1_USERNAME ?? '',
    password: process.env.CW1_PASSWORD ?? '',
    timeoutMs: Number(process.env.CW1_TIMEOUT_MS ?? 15000),

    /**
     * Which transport carries each family of message.
     *
     * `none` is a FIRST-CLASS value, not a broken state: the mechanism is still
     * open with the CargoWise team, so the whole platform must work with every
     * family set to none. Outbound messages are recorded and held; nothing in the
     * customer's experience depends on them.
     *
     * Per family rather than one global switch, so quotes can go live while
     * documents are still being agreed.
     */
    transport: {
      quote: process.env.CW1_TRANSPORT_QUOTE ?? 'none',
      shipment: process.env.CW1_TRANSPORT_SHIPMENT ?? 'none',
      booking: process.env.CW1_TRANSPORT_BOOKING ?? 'none',
      document: process.env.CW1_TRANSPORT_DOCUMENT ?? 'none',
      finance: process.env.CW1_TRANSPORT_FINANCE ?? 'none',
      organisation: process.env.CW1_TRANSPORT_ORGANISATION ?? 'none',
    },
  },

  /**
   * Outbound email. Empty until the Azure Communication Services resource exists;
   * the adapter reports 'not-configured' rather than failing a business write.
   */
  email: {
    azureConnectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING ?? '',
    senderAddress: process.env.AZURE_COMMUNICATION_SENDER ?? '',
    /** Where invitation links point. The SPA origin, not the API's. */
    portalBaseUrl: process.env.PORTAL_BASE_URL ?? '',
  },

  jobs: {
    enabled: (process.env.JOBS_ENABLED ?? 'true') === 'true',
    schema: process.env.JOBS_SCHEMA ?? 'pgboss',
  },

  /**
   * Uploaded files. `local` writes to disk for development; production is refused
   * unless the driver is azure-blob, because App Service disks do not persist.
   */
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    localRoot: process.env.STORAGE_LOCAL_ROOT ?? '.local-storage',
    container: process.env.STORAGE_CONTAINER ?? 'noatum-quote-documents',
    accountName: process.env.STORAGE_ACCOUNT_NAME ?? '',
    maxUploadBytes: Number(process.env.STORAGE_MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024),
  },
});

export type AppConfig = ReturnType<typeof configuration>;
