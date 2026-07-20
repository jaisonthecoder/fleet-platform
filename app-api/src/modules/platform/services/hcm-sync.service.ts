import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  assessFreshness,
  DEFAULT_HCM_FRESHNESS_SLA_MINUTES,
  type FreshnessAssessment,
  HCM_SOURCE,
  type HcmSource,
} from '../internal/hcm';
import { PlatformRepository } from '../repositories/platform.repository';

/**
 * HCM (Oracle Fusion) person sync + freshness (P1B-R1-6 / P1B-R2-2). Reconciles
 * the active-person set into `person` (idempotent upsert by `hcm_employee_id`)
 * and exposes the freshness policy the eligibility gate uses. Fail direction is
 * **block + escalate**: stale/unknown data is never treated as eligible.
 */
@Injectable()
export class HcmSyncService {
  private readonly logger = new Logger(HcmSyncService.name);

  constructor(
    @Inject(HCM_SOURCE) private readonly source: HcmSource,
    private readonly repo: PlatformRepository,
  ) {}

  /** Pulls the active-person set from HCM and upserts each; returns the count. */
  async sync(): Promise<{ synced: number; syncedAt: Date }> {
    const records = await this.source.fetchActivePersons();
    for (const record of records) {
      await this.repo.upsertPersonFromHcm({
        hcmEmployeeId: record.hcmEmployeeId,
        fullName: record.fullName,
        email: record.email ?? null,
        grade: record.grade ?? null,
        employmentStatus: record.employmentStatus,
        licenceNumber: record.licenceNumber ?? null,
        licenceExpiry: record.licenceExpiry ?? null,
        isProfessionalDriver: record.isProfessionalDriver ?? false,
        sponsor: record.sponsor ?? null,
      });
    }
    const syncedAt = new Date();
    this.logger.log(`HCM sync reconciled ${records.length} person(s) at ${syncedAt.toISOString()}`);
    return { synced: records.length, syncedAt };
  }

  /** Assesses whether a person's synced data is fresh enough to trust at the gate. */
  freshness(
    lastSyncedAt: Date | null | undefined,
    slaMinutes: number = DEFAULT_HCM_FRESHNESS_SLA_MINUTES,
  ): FreshnessAssessment {
    return assessFreshness(lastSyncedAt, slaMinutes);
  }
}

/** Dev/test HCM source — no external system; the real Oracle Fusion adapter replaces it. */
@Injectable()
export class StubHcmSource implements HcmSource {
  async fetchActivePersons() {
    return [];
  }
}
