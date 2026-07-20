import type {
  PolicyDecision,
  PolicyEvaluationResponse,
} from '../../../contracts/policy-evaluation.contract';

/**
 * A single decision-table row: `when` conditions → outcome. Matching is
 * equality per key; an omitted key is a wildcard. A value of `{ gte: n }` /
 * `{ lte: n }` compares numerically (kept minimal for Phase 0 rule types).
 */
export interface DecisionRow {
  /** Stable authoring identifier returned in simulation traces. */
  id?: string;
  /** Legacy compact condition map retained for existing seeded policies. */
  when?: Record<string, unknown>;
  /** Ordered, UI-authored conditions; every condition in a row must match. */
  conditions?: DecisionCondition[];
  decision: PolicyDecision;
  reasons: string[];
  route?: string[];
  value?: unknown;
}

export type DecisionOperator =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'notIn';

/** One typed predicate authored by the policy studio. */
export interface DecisionCondition {
  id: string;
  fact: string;
  operator: DecisionOperator;
  value: unknown;
}

/** The mandatory default outcome when no row matches (always the safe default). */
export interface DecisionDefault {
  decision: PolicyDecision;
  reasons: string[];
  route?: string[];
  value?: unknown;
}

/** A compiled, versioned decision table for one rule type at one scope. */
export interface DecisionTable {
  ruleType: string;
  version: string;
  scope: 'group' | 'cluster' | 'pool';
  rows: DecisionRow[];
  default: DecisionDefault;
}

/** Reason code marking a fail-safe verdict that a human must resolve (P0-R2-2). */
export const FAIL_SAFE_ESCALATE_REASON = 'fail-safe-escalate';

/** The safe fallback returned when a rule type has no active table (fail-safe). */
export function failSafe(ruleType: string): PolicyEvaluationResponse {
  return {
    decision: 'DENY',
    reasons: [`pdp-no-active-rule:${ruleType}`, FAIL_SAFE_ESCALATE_REASON],
    policyVersion: 'none',
    scopeThatAnswered: 'group',
  };
}

/** Matches a decision-table row's `when` clause against the context (eq/gte/lte). */
function matches(
  when: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  return Object.entries(when).every(([key, condition]) => {
    const actual = context[key];
    if (condition !== null && typeof condition === 'object') {
      const c = condition as Record<string, unknown>;
      if ('gte' in c) {
        return typeof actual === 'number' && actual >= Number(c.gte);
      }
      if ('lte' in c) {
        return typeof actual === 'number' && actual <= Number(c.lte);
      }
      return false;
    }
    return actual === condition;
  });
}

/** Evaluates one authored predicate without executing arbitrary expressions. */
function matchesCondition(
  condition: DecisionCondition,
  context: Record<string, unknown>,
): boolean {
  const actual = context[condition.fact];
  const expected = condition.value;

  switch (condition.operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'lt':
      return typeof actual === 'number' && actual < Number(expected);
    case 'lte':
      return typeof actual === 'number' && actual <= Number(expected);
    case 'gt':
      return typeof actual === 'number' && actual > Number(expected);
    case 'gte':
      return typeof actual === 'number' && actual >= Number(expected);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'notIn':
      return Array.isArray(expected) && !expected.includes(actual);
  }
}

/** Matches either the authored condition list or the legacy compact map. */
function matchesRow(
  row: DecisionRow,
  context: Record<string, unknown>,
): boolean {
  if (row.conditions) {
    return row.conditions.every((condition) =>
      matchesCondition(condition, context),
    );
  }
  return matches(row.when ?? {}, context);
}

/**
 * Pure decision-table evaluation: top-down, first-match-wins, with the
 * mandatory default when no row matches. No I/O — resolution/caching lives in
 * the evaluator service so this stays exhaustively unit-testable.
 */
export function evaluateTable(
  table: DecisionTable,
  context: Record<string, unknown>,
): PolicyEvaluationResponse {
  return evaluateTableWithTrace(table, context).response;
}

/** Evaluates a table and identifies the authored row selected by first-match. */
export function evaluateTableWithTrace(
  table: DecisionTable,
  context: Record<string, unknown>,
): { response: PolicyEvaluationResponse; matchedRowId: string | null } {
  for (const row of table.rows) {
    if (matchesRow(row, context)) {
      return {
        matchedRowId: row.id ?? null,
        response: {
          decision: row.decision,
          reasons: row.reasons,
          policyVersion: table.version,
          scopeThatAnswered: table.scope,
          route: row.route,
          value: row.value,
        },
      };
    }
  }
  return {
    matchedRowId: null,
    response: {
      decision: table.default.decision,
      reasons: table.default.reasons,
      policyVersion: table.version,
      scopeThatAnswered: table.scope,
      route: table.default.route,
      value: table.default.value,
    },
  };
}
