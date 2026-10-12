import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TenantRepository, type TenantClient } from '../../../common/tenancy/tenant.repository';
import { JobHandler, JOB_NAMES, type JobName } from '../job.registry';

/**
 * Blanks the payloads of settled integration messages past their retention.
 *
 * The store holds another system's payloads, which contain customer data. The
 * operational record — that an exchange happened, when, and what came of it —
 * is worth keeping; the payload is only needed while a replay is still plausible.
 *
 * Platform job: retention spans every customer, so it runs under the system
 * context JobsService establishes for a handler whose `tenantScoped` is false.
 */
@Injectable()
export class IntegrationRetentionHandler extends JobHandler<{ retainDays?: number }> {
  readonly name: JobName = JOB_NAMES.INTEGRATION_RETENTION;
  readonly tenantScoped = false;

  private readonly logger = new Logger(IntegrationRetentionHandler.name);

  constructor(
    private readonly repository: TenantRepository,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async handle(payload: { retainDays?: number } = {}): Promise<void> {
    const retainDays =
      payload.retainDays ?? this.config.get<number>('integration.retainMessageDays') ?? 395;

    const rows = await this.repository.runInternal(
      (tx: TenantClient) => tx.$queryRaw<Array<{ redacted: number }>>`
        SELECT app.redact_integration_messages(${retainDays}) AS redacted`,
    );

    const redacted = rows[0]?.redacted ?? 0;
    if (redacted > 0) {
      this.logger.log(`Redacted ${redacted} integration message payload(s) older than ${retainDays} days.`);
    }
  }
}
