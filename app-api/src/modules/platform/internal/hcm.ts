/** DI token for the HCM (Oracle Fusion) person source. */
export const HCM_SOURCE = Symbol('HCM_SOURCE');

/** A person record as delivered by HCM (the fields eligibility depends on). */
export interface HcmPersonRecord {
  hcmEmployeeId: string;
  fullName: string;
  email?: string | null;
  grade?: string | null;
  employmentStatus: string;
  licenceNumber?: string | null;
  licenceExpiry?: string | null;
  isProfessionalDriver?: boolean;
  sponsor?: string | null;
}

/** Source of HCM person data (real Oracle Fusion adapter or a stub in dev/test). */
export interface HcmSource {
  /** Returns the current active-person set to reconcile into `person`. */
  fetchActivePersons(): Promise<HcmPersonRecord[]>;
}

/** Freshness verdict for HCM-synced data used at the eligibility gate. */
export interface FreshnessAssessment {
  fresh: boolean;
  ageMinutes: number | null;
}

/** Default HCM freshness SLA — data older than this blocks + escalates. */
export const DEFAULT_HCM_FRESHNESS_SLA_MINUTES = 24 * 60;

/**
 * Freshness policy for HCM-synced person data (P1B-R2-2). Data is fresh when it
 * was last synced within the SLA. **Fail direction = block:** a null/unknown
 * last-sync is treated as **not fresh** (never fail-open), so the eligibility
 * gate blocks + escalates rather than allowing an ineligible driver on stale
 * data. Pure — the gate supplies `lastSyncedAt`/`now`.
 */
export function assessFreshness(
  lastSyncedAt: Date | null | undefined,
  slaMinutes: number = DEFAULT_HCM_FRESHNESS_SLA_MINUTES,
  now: Date = new Date(),
): FreshnessAssessment {
  if (!lastSyncedAt) {
    return { fresh: false, ageMinutes: null };
  }
  const ageMinutes = (now.getTime() - lastSyncedAt.getTime()) / 60_000;
  return { fresh: ageMinutes <= slaMinutes, ageMinutes };
}
