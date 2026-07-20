import { BadRequestException } from '@nestjs/common';
import type {
  AuthoredDecisionTable,
  PolicyFactDefinition,
} from '../../../contracts/policy-authoring.contract';
import { POLICY_FACT_CATALOG } from '../../../contracts/policy-authoring.contract';
import type { DecisionTable } from './decision-table';

const FACTS = new Map<string, PolicyFactDefinition>(
  POLICY_FACT_CATALOG.map((fact) => [fact.key, fact]),
);

/** Validates one authored value against the selected fact's data type. */
function isValueCompatible(fact: PolicyFactDefinition, value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every((item) => isValueCompatible(fact, item));
  }
  switch (fact.dataType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
    case 'enum':
      return typeof value === 'string';
  }
}

/** Compiles a validated UI-authored table into the side-effect-free runtime shape. */
export function compileAuthoredTable(authored: AuthoredDecisionTable): DecisionTable {
  const reasons: string[] = [];
  const rowIds = new Set<string>();

  for (const row of authored.rows) {
    if (rowIds.has(row.id)) {
      reasons.push(`duplicate-row-id:${row.id}`);
    }
    rowIds.add(row.id);

    for (const condition of row.conditions) {
      const fact = FACTS.get(condition.fact);
      if (!fact) {
        reasons.push(`unknown-fact:${condition.fact}`);
        continue;
      }
      if (!fact.operators.includes(condition.operator)) {
        reasons.push(`operator-not-allowed:${condition.fact}:${condition.operator}`);
      }
      if (!isValueCompatible(fact, condition.value)) {
        reasons.push(`invalid-value:${condition.fact}`);
      }
      if (
        fact.allowedValues &&
        (Array.isArray(condition.value)
          ? condition.value.some((value) => !fact.allowedValues?.includes(value as never))
          : !fact.allowedValues.includes(condition.value as never))
      ) {
        reasons.push(`value-not-allowed:${condition.fact}`);
      }
    }
  }

  if (reasons.length > 0) {
    throw new BadRequestException({
      title: 'Invalid policy definition',
      reasons,
    });
  }

  return {
    ruleType: authored.ruleType,
    version: authored.version,
    scope: authored.scope,
    rows: authored.rows.map((row) => ({
      id: row.id,
      conditions: row.conditions,
      decision: row.decision,
      reasons: row.reasons,
      route: row.route,
      value: row.value,
    })),
    default: authored.default,
  };
}
