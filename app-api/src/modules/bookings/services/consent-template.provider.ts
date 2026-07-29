import { createHash } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { ConsentAdministrationService } from '../../consent-administration/services/consent-administration.service';

export interface BookingConsentTemplate {
  version: string;
  contentHash: string;
  effectiveAtUtc: string;
  content: {
    en: string;
    ar: string;
  };
}

export abstract class ConsentTemplateProvider {
  /** Resolves the currently effective approved Booking consent template. */
  abstract current(organizationId?: string): Promise<BookingConsentTemplate | null>;
}

/** Fails closed except for explicit Jest or local-development dummy fixtures. */
@Injectable()
export class GovernedConsentTemplateProvider extends ConsentTemplateProvider {
  constructor(@Optional() private readonly registry?: ConsentAdministrationService) { super(); }

  /** Returns explicit non-production fixtures and no unapproved content elsewhere. */
  async current(organizationId?: string): Promise<BookingConsentTemplate | null> {
    const isTest = process.env.NODE_ENV === 'test';
    if (isTest) return this.environmentTemplate('BOOKING_TEST_CONSENT');
    const governed = await this.registry?.current('Booking', organizationId);
    if (governed) return governed;
    const isLocalDummy = process.env.NODE_ENV === 'local' &&
      ['1', 'true', 'yes', 'on'].includes(
        (process.env.BOOKING_LOCAL_DUMMY_CONSENT_ENABLED ?? '').toLowerCase(),
      );
    if (!isLocalDummy) return null;
    return this.environmentTemplate('BOOKING_LOCAL_DUMMY_CONSENT');
  }

  /** Resolves one explicit environment fixture without consulting persistence. */
  private environmentTemplate(prefix: string): BookingConsentTemplate | null {
    const version = process.env[`${prefix}_VERSION`];
    const effectiveAtUtc = process.env[`${prefix}_EFFECTIVE_AT_UTC`];
    const en = process.env[`${prefix}_EN`];
    const ar = process.env[`${prefix}_AR`];
    if (!version || !effectiveAtUtc || !en || !ar) return null;
    const content = { en, ar };
    const canonical = JSON.stringify(content);
    return {
      version,
      contentHash: createHash('sha256').update(canonical).digest('hex'),
      effectiveAtUtc,
      content,
    };
  }
}