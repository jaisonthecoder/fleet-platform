import type { DecisionTable } from './decision-table';
import { evaluateTable } from './decision-table';

const table: DecisionTable = {
  ruleType: 'booking-window',
  version: 'draft-v1',
  scope: 'group',
  rows: [
    {
      conditions: [
        { id: 'lead', fact: 'bookingLeadTimeDays', operator: 'lte', value: 21 },
        { id: 'concurrent', fact: 'concurrentBookings', operator: 'lt', value: 3 },
        { id: 'licence', fact: 'driverLicenceStatus', operator: 'eq', value: 'VALID' },
      ],
      decision: 'ALLOW',
      reasons: ['booking-window-allowed'],
    },
  ],
  default: { decision: 'DENY', reasons: ['booking-window-denied'] },
};

describe('evaluateTable authored conditions', () => {
  it('matches all dynamic conditions in a row', () => {
    expect(
      evaluateTable(table, {
        bookingLeadTimeDays: 21,
        concurrentBookings: 2,
        driverLicenceStatus: 'VALID',
      }),
    ).toMatchObject({ decision: 'ALLOW', reasons: ['booking-window-allowed'] });
  });

  it('uses the mandatory default when one condition fails', () => {
    expect(
      evaluateTable(table, {
        bookingLeadTimeDays: 22,
        concurrentBookings: 2,
        driverLicenceStatus: 'VALID',
      }),
    ).toMatchObject({ decision: 'DENY', reasons: ['booking-window-denied'] });
  });

  it('supports repeated facts for bounded ranges', () => {
    const range: DecisionTable = {
      ...table,
      rows: [{
        conditions: [
          { id: 'min', fact: 'durationHours', operator: 'gte', value: 1 },
          { id: 'max', fact: 'durationHours', operator: 'lte', value: 8 },
        ],
        decision: 'ALLOW',
        reasons: ['duration-in-range'],
      }],
    };
    expect(evaluateTable(range, { durationHours: 4 }).decision).toBe('ALLOW');
    expect(evaluateTable(range, { durationHours: 12 }).decision).toBe('DENY');
  });

  it('supports membership and exclusion operators', () => {
    const membership: DecisionTable = {
      ...table,
      rows: [{
        conditions: [
          { id: 'allowed', fact: 'vehicleClass', operator: 'in', value: ['pool', 'executive'] },
          { id: 'blocked', fact: 'jurisdiction', operator: 'notIn', value: ['BLOCKED'] },
        ],
        decision: 'ALLOW',
        reasons: ['membership-pass'],
      }],
    };
    expect(evaluateTable(membership, { vehicleClass: 'pool', jurisdiction: 'AE' }).decision).toBe('ALLOW');
    expect(evaluateTable(membership, { vehicleClass: 'pool', jurisdiction: 'BLOCKED' }).decision).toBe('DENY');
  });
});
