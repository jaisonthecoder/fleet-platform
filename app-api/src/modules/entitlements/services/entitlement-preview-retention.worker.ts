import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntitlementsRepository } from '../repositories/entitlements.repository';

/** Removes expired, unreferenced eligibility previews on a bounded schedule. */
@Injectable()
export class EntitlementPreviewRetentionWorker {
  constructor(private readonly repo: EntitlementsRepository) {}

  /** Runs daily retention while preserving evidence referenced by requests. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run(): Promise<void> {
    await this.repo.deleteExpiredUnreferencedPreviews(new Date(Date.now() - 24 * 60 * 60_000));
  }
}