import {
  authoredDecisionTableSchema,
  POLICY_FACT_CATALOG,
  policyFactDefinitionSchema,
} from './policy-authoring.contract';

describe('policy authoring contract', () => {
  it('keeps every fact metadata entry valid and bilingual', () => {
    expect(POLICY_FACT_CATALOG.length).toBeGreaterThan(10);
    for (const fact of POLICY_FACT_CATALOG) {
      expect(policyFactDefinitionSchema.safeParse(fact).success).toBe(true);
      expect(fact.labelAr.trim()).not.toBe('');
      expect(fact.descriptionAr.trim()).not.toBe('');
    }
  });

  it('rejects a row without conditions and a default without reasons', () => {
    const result = authoredDecisionTableSchema.safeParse({
      schemaVersion: 1,
      ruleType: 'booking-buffer',
      version: 'draft',
      scope: 'group',
      rows: [{ id: 'row', conditions: [], decision: 'VALUE', reasons: ['value'], value: 15 }],
      default: { decision: 'DENY', reasons: [] },
    });
    expect(result.success).toBe(false);
  });
});
