import { createHash, randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import { fromPrisma } from 'pg-boss/dist/adapters/prisma.js';

import { TenantContext } from '../../common/tenancy/tenant-context';
import type { TenantClient } from '../../common/tenancy/tenant.repository';

import { JobHandler, JOB_HANDLERS_TOKEN, JOB_NAMES, type JobName } from './job.registry';

/**
 * In-process job runner on pg-boss, so there is one datastore and no broker to operate.
 *
 * Two rules make this safe:
 *  - a job never inherits the enqueuing request context; JobsService establishes a fresh
 *    one from the payload, so a job cannot accidentally run as the wrong tenant;
 *  - a tenant-scoped job must carry customerGroupId, and is rejected at enqueue if not.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);
  private boss?: PgBoss;
  private readonly handlers = new Map<JobName, JobHandler>();

  constructor(
    private readonly config: ConfigService,
    private readonly context: TenantContext,
    @Inject(JOB_HANDLERS_TOKEN) registered: JobHandler[],
  ) {
    for (const handler of registered) {
      if (this.handlers.has(handler.name)) {
        throw new Error(`Duplicate job handler for ${handler.name}.`);
      }
      this.handlers.set(handler.name, handler);
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('jobs.enabled')) {
      this.logger.warn('Jobs disabled by configuration; nothing will be processed.');
      return;
    }

    this.boss = new PgBoss({
      connectionString: this.config.getOrThrow<string>('database.url'),
      schema: this.config.get<string>('jobs.schema') ?? 'pgboss',
      createSchema: false,
      migrate: false,
    });

    this.boss.on('error', (error) => this.logger.error({ err: error }, 'pg-boss error'));
    await this.boss.start();

    for (const [name, handler] of this.handlers) {
      await this.boss.createQueue(name);
      await this.boss.work(name, { localConcurrency: 2, pollingIntervalSeconds: 5 }, async ([job]) => {
        if (!job) return;
        await this.execute(handler, job.data);
      });
    }

    this.logger.log(`Job runner started with ${this.handlers.size} handler(s).`);

    // Deliberately not awaited. Registering schedules talks to the database and is
    // maintenance, not a precondition for serving traffic - awaiting it made a slow
    // or unavailable scheduler hold the whole application in startup.
    void this.scheduleRecurring().catch((error: unknown) =>
      this.logger.error({ err: error }, 'Background scheduling failed.'),
    );
  }

  /**
   * Gives the recurring platform jobs a heartbeat.
   *
   * Until now nothing scheduled anything, so `master-org.sync` never ran and the
   * "Scheduled run" the import screen reports was aspirational. pg-boss keeps the
   * schedule in the database, so re-registering on every boot is how a changed
   * cron takes effect, and two instances share one schedule rather than doubling it.
   *
   * Only platform jobs appear here. A tenant-scoped job needs a customer in its
   * payload, which a schedule has no way to supply, so it is fanned out by a
   * platform job instead — see `quote.expiry.fanout`.
   */
  private async scheduleRecurring(): Promise<void> {
    if (!this.boss) return;

    const schedules: Array<{ name: JobName; cron: string; why: string }> = [
      // Frequent and cheap: it exits immediately when nothing is due, and this is
      // what makes a held CargoWise message leave the building the moment a
      // transport is configured.
      { name: JOB_NAMES.INTEGRATION_RELAY, cron: '* * * * *', why: 'deliver recorded outbound messages' },
      // Hourly is enough for a validity date, and it keeps the fan-out small.
      { name: JOB_NAMES.QUOTE_EXPIRY_FANOUT, cron: '5 * * * *', why: 'expire quotes past their validity' },
      // Overnight: the organisation directory changes slowly and an authoritative
      // run can deactivate rows, so it should not surprise anyone mid-morning.
      { name: JOB_NAMES.MASTER_ORG_SYNC, cron: '30 2 * * *', why: 'refresh the organisation directory' },
      // Daily and quiet. Retention only ever blanks settled payloads.
      { name: JOB_NAMES.INTEGRATION_RETENTION, cron: '45 3 * * *', why: 'redact integration payloads past retention' },
    ];

    for (const entry of schedules) {
      if (!this.handlers.has(entry.name)) continue;

      try {
        await this.boss.schedule(entry.name, entry.cron, {}, { tz: 'UTC' });
        this.logger.log(`Scheduled ${entry.name} (${entry.cron} UTC) to ${entry.why}.`);
      } catch (error) {
        // A failed schedule must not stop the application: the queue still works
        // and an operator can trigger the job by hand.
        this.logger.error({ err: error }, `Could not schedule ${entry.name}.`);
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    // Let in-flight jobs finish rather than leaving half-written CW1 interactions.
    await this.boss?.stop({ graceful: true });
  }

  async enqueue(
    transaction: TenantClient,
    name: JobName,
    payload: Record<string, unknown>,
    identity: { sourceMessageId: string; portalRef: string },
  ): Promise<string | null> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`No handler registered for job ${name}.`);
    }
    if (handler.tenantScoped && !payload.customerGroupId) {
      throw new Error(`Job ${name} is tenant-scoped and requires customerGroupId in its payload.`);
    }
    if (!this.boss) {
      throw new Error('Job runner is not started.');
    }
    if (!identity || typeof identity.sourceMessageId !== 'string' || !identity.sourceMessageId.trim()
      || typeof identity.portalRef !== 'string' || !identity.portalRef.trim()) {
      throw new Error('Job enqueue requires a source message ID and portal reference.');
    }

    const digest = createHash('sha256').update(JSON.stringify([
      'noatum-job-v1', name, handler.tenantScoped ? payload.customerGroupId : null,
      identity.sourceMessageId, identity.portalRef,
    ])).digest();
    digest[6] = (digest[6]! & 0x0f) | 0x80;
    digest[8] = (digest[8]! & 0x3f) | 0x80;
    const hex = digest.subarray(0, 16).toString('hex');
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

    return this.boss.send(name, payload, {
      id,
      db: fromPrisma(transaction),
      retryLimit: 3,
      retryBackoff: true,
    });
  }

  private async execute(handler: JobHandler, payload: unknown): Promise<void> {
    const correlationId = randomUUID();
    const data = (payload ?? {}) as { customerGroupId?: string };

    const run = () => handler.handle(payload);

    if (!handler.tenantScoped) {
      await this.context.runAsSystem(correlationId, run);
      return;
    }

    if (!data.customerGroupId) {
      // Fail loudly: silently running with no tenant is how cross-tenant leaks happen.
      throw new Error(`Job ${handler.name} ran without customerGroupId.`);
    }

    await this.context.run(
      {
        customerGroupId: data.customerGroupId,
        userId: 'system',
        isInternal: false,
        accountIds: [],
        permissions: new Set<string>(),
        correlationId,
      },
      run,
    );
  }
}
