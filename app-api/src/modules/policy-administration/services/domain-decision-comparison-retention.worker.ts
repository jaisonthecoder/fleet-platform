import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DomainDecisionAdministrationService } from './domain-decision-administration.service';

/** Deletes expired privacy-minimized decision comparisons once per day. */
@Injectable()
export class DomainDecisionComparisonRetentionWorker {
  private readonly logger = new Logger(DomainDecisionComparisonRetentionWorker.name);

  constructor(
    private readonly administration: DomainDecisionAdministrationService,
    private readonly config: ConfigService,
  ) {}

  /** Runs the bounded retention cleanup and contains failures for the next run. */
  @Cron('0 15 2 * * *')
  async run(): Promise<void> {
    try {
      const days = this.config.get<number>('DOMAIN_DECISION_COMPARISON_RETENTION_DAYS') ?? 90;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const organizations = await this.administration.comparisonOrganizationIds();
      for (const organizationId of organizations) {
        try {
          const deleted = await this.administration.deleteComparisonsBefore(organizationId, cutoff);
          if (deleted) this.logger.log({ event: 'domain_decision_comparison_retention', organizationId, deleted, cutoff: cutoff.toISOString() });
        } catch (error) {
          this.logger.error(`Decision comparison retention failed for organization ${organizationId}`, error instanceof Error ? error.stack : String(error));
        }
      }
    } catch (error) {
      this.logger.error('Decision comparison organization discovery failed', error instanceof Error ? error.stack : String(error));
    }
  }
}