/** Injection token for the resolved handler array. */
export const JOB_HANDLERS_TOKEN = Symbol('NOATUM_JOB_HANDLERS');

export const JOB_NAMES = {
  MASTER_ORG_SYNC: 'master-org.sync',
  SHIPMENT_REFRESH: 'shipment.refresh',
  QUOTE_EXPIRY: 'quote.expiry',
  /** Delivers recorded outbound messages once a transport exists. */
  INTEGRATION_RELAY: 'integration.relay',
  /** One scheduled tick becomes one tenant-scoped expiry job per live customer. */
  QUOTE_EXPIRY_FANOUT: 'quote.expiry.fanout',
  /** Blanks settled integration message payloads past their retention. */
  INTEGRATION_RETENTION: 'integration.retention',
  /** Tells the customer their quote is ready. Never sent inline from publish. */
  QUOTE_PUBLISHED_NOTIFY: 'quote.published.notify',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

/**
 * Every handler implements this.
 *
 * `tenantScoped` decides how JobsService establishes context: a tenant-scoped job runs
 * with a non-internal context for TenantRepository.run using its customerGroupId; a platform
 * job runs under runAsSystem and must not touch customer data.
 */
export abstract class JobHandler<TPayload = unknown> {
  abstract readonly name: JobName;
  abstract readonly tenantScoped: boolean;
  abstract handle(payload: TPayload): Promise<void>;
}
