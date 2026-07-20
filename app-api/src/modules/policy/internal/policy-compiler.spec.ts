import { BadRequestException } from '@nestjs/common';
import type { AuthoredDecisionTable } from '../../../contracts/policy-authoring.contract';
import { compileAuthoredTable } from './policy-compiler';

const authored: AuthoredDecisionTable = {
  schemaVersion: 1,
  ruleType: 'booking-buffer',
  version: 'draft-v2',
  scope: 'group',
  rows: [{
    id: 'row-1',
    conditions: [{ id: 'condition-1', fact: 'vehicleClass', operator: 'eq', value: 'executive' }],
    decision: 'VALUE',
    reasons: ['executive-buffer'],
    value: 30,
  }],
  default: { decision: 'VALUE', reasons: ['default-buffer'], value: 15 },
};

describe('compileAuthoredTable', () => {
  it('compiles an authored table to the runtime representation', () => {
    expect(compileAuthoredTable(authored)).toMatchObject({
      ruleType: 'booking-buffer',
      version: 'draft-v2',
      rows: [{ conditions: authored.rows[0].conditions, decision: 'VALUE', value: 30 }],
    });
  });

  it('rejects unknown facts and incompatible operators', () => {
    expect(() => compileAuthoredTable({
      ...authored,
      rows: [{
        ...authored.rows[0],
        conditions: [
          { id: 'unknown', fact: 'notRegistered', operator: 'eq', value: true },
          { id: 'invalid-op', fact: 'vehicleClass', operator: 'gte', value: 1 },
        ],
      }],
    })).toThrow(BadRequestException);
  });

  it('rejects values outside a fact catalogue enum', () => {
    expect(() => compileAuthoredTable({
      ...authored,
      rows: [{
        ...authored.rows[0],
        conditions: [{ id: 'bad-value', fact: 'vehicleClass', operator: 'eq', value: 'spaceship' }],
      }],
    })).toThrow(BadRequestException);
  });
});
