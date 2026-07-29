import { createHash } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { ConsentAdministrationService } from '../../consent-administration/services/consent-administration.service';

export interface EntitlementConsentTemplate {
  version: string;
  contentHash: string;
  effectiveAtUtc: string;
  content: { en: string; ar: string };
}

export abstract class EntitlementConsentTemplateProvider {
  /** Resolves the current approved or explicit non-production Dedicated consent. */
  abstract current(organizationId?: string): Promise<EntitlementConsentTemplate | null>;
}

/** Fails closed except for explicitly configured Jest or local-development fixtures. */
@Injectable()
export class GovernedEntitlementConsentTemplateProvider extends EntitlementConsentTemplateProvider {
  constructor(@Optional() private readonly registry?: ConsentAdministrationService) { super(); }

  /** Returns configured non-production content and no invented production consent. */
  async current(organizationId?: string): Promise<EntitlementConsentTemplate | null> {
    const isTest = process.env.NODE_ENV === 'test';
    if (isTest) return this.environmentTemplate('ENTITLEMENT_TEST_CONSENT');
    const governed = await this.registry?.current('DedicatedVehicle', organizationId);
    if (governed) return governed;
    const isLocal = process.env.NODE_ENV === 'local' && ['1', 'true', 'yes', 'on'].includes(
      (process.env.ENTITLEMENT_LOCAL_DUMMY_CONSENT_ENABLED ?? '').toLowerCase(),
    );
    if (!isLocal) return null;
    return this.environmentTemplate('ENTITLEMENT_LOCAL_DUMMY_CONSENT');
  }

  /** Resolves one explicit environment fixture without consulting persistence. */
  private environmentTemplate(prefix: string): EntitlementConsentTemplate | null {
    const version = process.env[`${prefix}_VERSION`];
    const effectiveAtUtc = process.env[`${prefix}_EFFECTIVE_AT_UTC`];
    const en = process.env[`${prefix}_EN`];
    const ar = process.env[`${prefix}_AR`];
    if (!version || !effectiveAtUtc || !en || !ar) return null;
    const content = { en, ar };
    return {
      version,
      effectiveAtUtc,
      content,
      contentHash: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
    };
  }
}