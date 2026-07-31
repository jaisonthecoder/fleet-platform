import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HandoverService } from './handover.service';

/** Removes expired, unclaimed private Handover evidence on a bounded schedule. */
@Injectable()
export class HandoverEvidenceRetentionWorker {
  private readonly logger = new Logger(HandoverEvidenceRetentionWorker.name);

  constructor(private readonly handovers: HandoverService) {}

  /** Runs hourly cleanup while containing storage failures for the next retry. */
  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      const result = await this.handovers.cleanupExpiredEvidence();
      if (result.expired || result.deleted || result.failed) {
        this.logger.log({ event: 'handover_evidence_cleanup', ...result });
      }
    } catch (error) {
      this.logger.error(
        'Handover evidence cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
