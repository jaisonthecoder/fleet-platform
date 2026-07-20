import { Injectable } from '@nestjs/common';
import type { DecisionTable } from './decision-table';

/**
 * Holds the active decision tables the PDP interprets. Phase 1 seeds all 12
 * governed rule types (+ the advisory fuel-deviation rule) as decision tables;
 * the PDP still prefers a Postgres-activated `policy_version` (read-through) or
 * Redis cache over these seeds — they are the safe last-resort defaults. Rule
 * types whose production values are governance-gated (D3/D6/D8/D9/D12/D14) are
 * seeded as clearly-marked **fixtures** (version prefix `fixture-`) until the
 * decision is signed off and a real version is activated. Business rule values
 * live here as data — never as hard-coded `if`s (FR-ARC-03).
 */
@Injectable()
export class PolicyRegistryService {
  private readonly tables = new Map<string, DecisionTable>();

  constructor() {
    this.seedDefaults();
  }

  /** Returns the active decision table for a rule type, if any. */
  getActive(ruleType: string): DecisionTable | undefined {
    return this.tables.get(ruleType);
  }

  /** Registers/replaces a decision table (used by seeding and, later, activation). */
  register(table: DecisionTable): void {
    this.tables.set(table.ruleType, table);
  }

  /** All seeded rule-type names (used by tests / completeness checks). */
  ruleTypes(): string[] {
    return [...this.tables.keys()];
  }

  /** Seeds every Phase-1 rule type as a decision table (config + fixtures). */
  private seedDefaults(): void {
    // 1. booking-buffer — minutes of buffer around a reservation (config).
    this.register({
      ruleType: 'booking-buffer',
      version: 'phase1-booking-buffer-v1',
      scope: 'group',
      rows: [{ when: { vehicleClass: 'executive' }, decision: 'VALUE', reasons: ['buffer-executive'], value: 30 }],
      default: { decision: 'VALUE', reasons: ['buffer-default'], value: 15 },
    });

    // 2. driver-eligibility — quick allow/deny (config).
    this.register({
      ruleType: 'driver-eligibility',
      version: 'phase1-driver-eligibility-v1',
      scope: 'group',
      rows: [{ when: { eligible: true }, decision: 'ALLOW', reasons: ['driver-eligible'] }],
      default: { decision: 'DENY', reasons: ['driver-eligibility-not-proven'] },
    });

    // 3. max-booking-duration — max hours (VALUE), most-restrictive default (D3 fixture).
    this.register({
      ruleType: 'max-booking-duration',
      version: 'fixture-max-booking-duration-v1',
      scope: 'group',
      rows: [
        { when: { vehicleClass: 'executive' }, decision: 'VALUE', reasons: ['max-duration-executive'], value: 168 },
        { when: { vehicleClass: 'pool' }, decision: 'VALUE', reasons: ['max-duration-pool'], value: 24 },
      ],
      default: { decision: 'VALUE', reasons: ['max-duration-default'], value: 24 },
    });

    // 4. booking-approval-chain — ROUTE_TO an approval chain; fail-safe escalates (D6 fixture).
    this.register({
      ruleType: 'booking-approval-chain',
      version: 'fixture-booking-approval-chain-v1',
      scope: 'group',
      rows: [
        { when: { durationHours: { lte: 4 } }, decision: 'ROUTE_TO', reasons: ['chain-line-manager'], route: ['LineManager'] },
        { when: { durationHours: { gte: 24 } }, decision: 'ROUTE_TO', reasons: ['chain-fleet-manager'], route: ['LineManager', 'FleetManager'] },
      ],
      default: { decision: 'ROUTE_TO', reasons: ['chain-default-line-manager'], route: ['LineManager'] },
    });

    // 5. entitlement-approval-chain — ROUTE_TO up to Cluster CEO (config).
    this.register({
      ruleType: 'entitlement-approval-chain',
      version: 'phase1-entitlement-approval-chain-v1',
      scope: 'group',
      rows: [
        { when: { requestType: 'permanent' }, decision: 'ROUTE_TO', reasons: ['chain-permanent'], route: ['LineManager', 'FleetManager', 'ClusterFleetLead', 'ClusterCEO'] },
      ],
      default: { decision: 'ROUTE_TO', reasons: ['chain-entitlement-default'], route: ['LineManager', 'FleetManager', 'ClusterCEO'] },
    });

    // 6. dedicated-vehicle-eligibility — ALLOW/DENY, DENY default (D8 fixture).
    this.register({
      ruleType: 'dedicated-vehicle-eligibility',
      version: 'fixture-dedicated-vehicle-eligibility-v1',
      scope: 'group',
      rows: [{ when: { gradeEligible: true }, decision: 'ALLOW', reasons: ['dedicated-grade-eligible'] }],
      default: { decision: 'DENY', reasons: ['dedicated-not-eligible'] },
    });

    // 7. driver-eligibility-gate — composite ALLOW/DENY, DENY default (config).
    this.register({
      ruleType: 'driver-eligibility-gate',
      version: 'phase1-driver-eligibility-gate-v1',
      scope: 'group',
      rows: [
        { when: { licenceValid: true, notBlocked: true, vehicleDocsValid: true }, decision: 'ALLOW', reasons: ['eligibility-gate-pass'] },
      ],
      default: { decision: 'DENY', reasons: ['eligibility-gate-fail'] },
    });

    // 8. compliance-alert-ladders — VALUE (day offsets), most-aggressive default (D9 fixture).
    this.register({
      ruleType: 'compliance-alert-ladders',
      version: 'fixture-compliance-alert-ladders-v1',
      scope: 'group',
      rows: [
        { when: { itemType: 'insurance' }, decision: 'VALUE', reasons: ['ladder-insurance'], value: [60, 30, 14, 7, 1] },
        { when: { itemType: 'registration' }, decision: 'VALUE', reasons: ['ladder-registration'], value: [60, 30, 14, 7, 1] },
        { when: { itemType: 'licence' }, decision: 'VALUE', reasons: ['ladder-licence'], value: [30, 14, 7, 1] },
      ],
      default: { decision: 'VALUE', reasons: ['ladder-default'], value: [30, 14, 7, 1] },
    });

    // 9. hard-block-conditions — DENY on an expiry; no override (config, structural).
    this.register({
      ruleType: 'hard-block-conditions',
      version: 'phase1-hard-block-conditions-v1',
      scope: 'group',
      rows: [
        { when: { registrationExpired: true }, decision: 'DENY', reasons: ['hard-block-registration-expired'] },
        { when: { insuranceExpired: true }, decision: 'DENY', reasons: ['hard-block-insurance-expired'] },
      ],
      default: { decision: 'ALLOW', reasons: ['no-hard-block'] },
    });

    // 10. fines-hr-threshold — VALUE {count, months} (D12 fixture).
    this.register({
      ruleType: 'fines-hr-threshold',
      version: 'fixture-fines-hr-threshold-v1',
      scope: 'group',
      rows: [],
      default: { decision: 'VALUE', reasons: ['fines-hr-threshold-default'], value: { count: 3, months: 12 } },
    });

    // 11. black-point-timeframe — VALUE transfer deadline days (D14 fixture).
    this.register({
      ruleType: 'black-point-timeframe',
      version: 'fixture-black-point-timeframe-v1',
      scope: 'group',
      rows: [],
      default: { decision: 'VALUE', reasons: ['black-point-timeframe-default'], value: { transferDeadlineDays: 14 } },
    });

    // 12. consent-re-consent-tolerance — VALUE tolerance minutes; 0 = any change re-consents (config).
    this.register({
      ruleType: 'consent-re-consent-tolerance',
      version: 'phase1-consent-re-consent-tolerance-v1',
      scope: 'group',
      rows: [],
      default: { decision: 'VALUE', reasons: ['re-consent-any-change'], value: { toleranceMinutes: 0 } },
    });

    // 13. fuel-deviation-threshold — VALUE percent (advisory only, config).
    this.register({
      ruleType: 'fuel-deviation-threshold',
      version: 'phase1-fuel-deviation-threshold-v1',
      scope: 'group',
      rows: [],
      default: { decision: 'VALUE', reasons: ['fuel-deviation-default'], value: { percent: 12 } },
    });
  }
}
