import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDatabase } from '../database/database.module';
import { scheduledWork } from '../database/schema';

/** Well-known escalation work types (durable `scheduled_work.work_type`). */
export const ESCALATION_WORK_TYPE = {
  /** PDP returned a fail-safe DENY (no active rule / outage) — route to a human. */
  pdpFailSafe: 'escalation:pdp-fail-safe',
  /** An approval step passed its SLA without a decision. */
  workflowSlaTimeout: 'escalation:workflow-sla-timeout',
} as const;

/** Input for enqueuing a human escalation. */
export interface EscalationRequest {
  workType: string;
  /** The entity the escalation is about (e.g. `pdp:driver-eligibility`, a workflow id). */
  subjectRef: string;
  reason: string;
  correlationId?: string;
  /** When the escalation is due; defaults to now (act immediately). */
  dueAt?: Date;
}

/**
 * Shared escalation port. Enqueues a durable `scheduled_work` row that a human
 * router / BullMQ worker picks up later. It is the interim "+ escalate" half of
 * the PDP fail-safe (P0-R2-2) and the target of workflow SLA timeouts. Kept in
 * `common/` because both the PDP and the API deployables need it without
 * coupling their feature modules. Best-effort by contract: enqueuing an
 * escalation must never throw back into the decision path that requested it.
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Enqueues an escalation and returns its `scheduled_work` id (or null on failure). */
  async escalate(request: EscalationRequest): Promise<string | null> {
    try {
      const rows = await this.db
        .insert(scheduledWork)
        .values({
          workType: request.workType,
          subjectRef: request.subjectRef,
          dueAt: request.dueAt ?? new Date(),
          status: 'Pending',
        })
        .returning({ id: scheduledWork.id });
      this.logger.warn(
        `escalation queued [${request.workType}] subject=${request.subjectRef} reason=${request.reason}` +
          (request.correlationId ? ` correlation=${request.correlationId}` : ''),
      );
      return rows[0]?.id ?? null;
    } catch (error) {
      this.logger.error(
        `escalation enqueue FAILED [${request.workType}] subject=${request.subjectRef}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return null;
    }
  }
}
