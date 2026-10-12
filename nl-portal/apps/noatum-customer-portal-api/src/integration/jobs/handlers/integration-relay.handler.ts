import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TenantRepository, type TenantClient } from '../../../common/tenancy/tenant.repository';
import { JobHandler, JOB_NAMES, type JobName } from '../job.registry';

/** Message families, each with its own transport setting. */
const FAMILIES = ['quote', 'shipment', 'booking', 'document', 'finance', 'organisation'] as const;

/**
 * Watches the outbound queue while the CargoWise transport is still being agreed.
 *
 * Every `CW1_TRANSPORT_*` is `none` and no transport class is bound, so there is
 * nowhere to deliver anything. This reports what is waiting and returns. Messages
 * stay `pending` — which is the hold that was asked for, and the reason the store
 * exists.
 *
 * **Deliberately does not claim rows.** An earlier version moved them to `sending`
 * and released them again each pass. That inflated `attempts`, pushed real first
 * attempts up to four hours into the future through backoff, and — because a claim
 * and its release commit in different transactions — left rows stranded in
 * `sending` after any restart, where nothing would ever pick them up again.
 * Claiming is only correct once something can actually send, so it lands with the
 * transport in C2, together with a reaper for stale claims and tests for both.
 * The `sending` status stays in the enum as that seam.
 *
 * Platform job: it spans customers by design, so it runs under the system context
 * JobsService establishes for a handler whose `tenantScoped` is false.
 */
@Injectable()
export class IntegrationRelayHandler extends JobHandler<Record<string, never>> {
  readonly name: JobName = JOB_NAMES.INTEGRATION_RELAY;
  readonly tenantScoped = false;

  private readonly logger = new Logger(IntegrationRelayHandler.name);
  private lastReport = 0;

  constructor(
    private readonly repository: TenantRepository,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async handle(): Promise<void> {
    // Runs every minute; reporting each pass would be 1,440 identical lines a day
    // telling an operator something they already know.
    const now = Date.now();
    if (now - this.lastReport < 60 * 60 * 1000) return;
    this.lastReport = now;

    const waiting = await this.repository.runInternal((tx: TenantClient) =>
      tx.integrationMessage.count({ where: { direction: 'outbound', status: 'pending' } }),
    );

    if (waiting === 0) return;

    const configured = FAMILIES.filter((family) => this.transportFor(family) !== 'none');

    if (configured.length === 0) {
      this.logger.log(
        `${waiting} outbound message(s) held: no CW1_TRANSPORT_* is configured. ` +
        'They stay pending and are delivered once a transport exists.',
      );
      return;
    }

    // Someone has set a transport but no implementation is bound to carry it, so
    // the messages still cannot move. Say so loudly rather than quietly holding
    // them: this is a misconfiguration, not the expected resting state.
    this.logger.error(
      `${waiting} outbound message(s) waiting. A transport is configured for ` +
      `${configured.join(', ')} but no implementation is bound, so nothing can be sent.`,
    );
  }

  /**
   * Which transport carries this family.
   *
   * Per family rather than one global setting, so quotes can go live while
   * documents are still being agreed. `none` is a first-class value: the whole
   * platform must work with every family set to it.
   */
  private transportFor(family: string): string {
    return this.config.get<string>(`cw1.transport.${family}`) ?? 'none';
  }
}
