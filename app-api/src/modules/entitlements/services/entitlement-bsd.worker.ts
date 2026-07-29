import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntitlementService } from './entitlement.service';

/** Runs automatic BSD Pool activation/restoration while containing cycle failures. */
@Injectable()
export class EntitlementBsdWorker {
  constructor(private readonly entitlements: EntitlementService) {}

  /** Runs the advisory-lock-protected BSD reconciliation cycle. */
  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    try { await this.entitlements.runBsdCycle(); }
    catch { /* next cycle retries; service operations remain transactional */ }
  }
}