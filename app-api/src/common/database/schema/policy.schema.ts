import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { hierarchyNode } from './platform.schema';

export const policyStatusEnum = pgEnum('fleet_policy_status', [
  'Draft',
  'InReview',
  'Approved',
  'Active',
  'Superseded',
]);

/** A registered policy rule at a hierarchy scope (group/cluster/pool inheritance). */
export const policyRule = fleet.table(
  'policy_rule',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    ruleType: text('rule_type').notNull(),
    scopeNodeId: uuid('scope_node_id').references(() => hierarchyNode.id),
    status: policyStatusEnum('status').notNull().default('Draft'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdBy: text('created_by'),
    approvedBy: text('approved_by'),
    createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('policy_rule_type_idx').on(t.ruleType, t.status)],
);

/** Immutable, versioned JSONB decision table (insert-only). */
export const policyVersion = fleet.table(
  'policy_version',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    policyRuleId: uuid('policy_rule_id').notNull().references(() => policyRule.id),
    version: integer('version').notNull(),
    decisionTable: jsonb('decision_table').notNull(),
    inputSchemaRef: text('input_schema_ref'),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('policy_version_rule_idx').on(t.policyRuleId, t.version)],
);

/** Append-only log of every PDP evaluation (feeds the audit trail). */
export const decisionLog = fleet.table(
  'decision_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    ruleType: text('rule_type').notNull(),
    policyVersionId: uuid('policy_version_id'),
    contextFingerprint: text('context_fingerprint'),
    decision: text('decision').notNull(),
    reasons: text('reasons').array(),
    scopeThatAnswered: text('scope_that_answered'),
    requestedScopeNodeId: uuid('requested_scope_node_id').references(() => hierarchyNode.id),
    resolvedScopeNodeId: uuid('resolved_scope_node_id').references(() => hierarchyNode.id),
    subjectRef: text('subject_ref'),
    correlationId: text('correlation_id'),
    evaluatedAtUtc: timestamp('evaluated_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('decision_log_rule_idx').on(t.ruleType, t.evaluatedAtUtc)],
);

/** Append-only, privacy-minimized comparison of legacy and new domain decisions. */
export const domainDecisionComparison = fleet.table(
  'domain_decision_comparison',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    decisionKey: text('decision_key').notNull(),
    environment: text('environment').notNull().default('default'),
    consumer: text('consumer').notNull(),
    subjectRef: text('subject_ref').notNull(),
    correlationId: text('correlation_id').notNull(),
    requestedScopeNodeId: uuid('requested_scope_node_id').references(() => hierarchyNode.id),
    resolvedScopeNodeId: uuid('resolved_scope_node_id').references(() => hierarchyNode.id),
    mode: text('mode').notNull(),
    factFingerprint: text('fact_fingerprint').notNull(),
    legacyResult: jsonb('legacy_result'),
    newResult: jsonb('new_result'),
    category: text('category').notNull(),
    legacyPolicyVersion: text('legacy_policy_version'),
    newPolicyVersion: text('new_policy_version'),
    legacyErrorCode: text('legacy_error_code'),
    newErrorCode: text('new_error_code'),
    comparedAtUtc: timestamp('compared_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('domain_decision_comparison_request_uq').on(
      t.organizationId,
      t.environment,
      t.decisionKey,
      t.consumer,
      t.correlationId,
      t.factFingerprint,
    ),
    index('domain_decision_comparison_key_idx').on(
      t.organizationId,
      t.decisionKey,
      t.comparedAtUtc,
    ),
  ],
);

/** Persistent selector mode and deterministic canary percentage by org/scope/key. */
export const domainDecisionSelector = fleet.table(
  'domain_decision_selector',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    environment: text('environment').notNull().default('default'),
    decisionKey: text('decision_key').notNull(),
    scopeNodeId: uuid('scope_node_id').references(() => hierarchyNode.id),
    mode: text('mode').notNull().default('legacy-only'),
    canaryPercentage: integer('canary_percentage').notNull().default(0),
    comparisonSamplePercentage: integer('comparison_sample_percentage').notNull().default(100),
    revision: integer('revision').notNull().default(1),
    updatedBy: text('updated_by'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('domain_decision_selector_org_env_key_scope_uq').on(
      t.organizationId,
      t.environment,
      t.decisionKey,
      sql`coalesce(${t.scopeNodeId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    check(
      'domain_decision_selector_canary_range',
      sql`${t.canaryPercentage} >= 0 AND ${t.canaryPercentage} <= 100`,
    ),
    check(
      'domain_decision_selector_sample_range',
      sql`${t.comparisonSamplePercentage} >= 0 AND ${t.comparisonSamplePercentage} <= 100`,
    ),
  ],
);

/** Mutable policy-studio working copy; active policy versions remain immutable. */
export const policyDraft = fleet.table(
  'policy_draft',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    ruleType: text('rule_type').notNull(),
    scopeNodeId: uuid('scope_node_id').references(() => hierarchyNode.id),
    revision: integer('revision').notNull().default(1),
    authoredDefinition: jsonb('authored_definition').notNull(),
    createdBy: text('created_by').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('policy_draft_org_rule_scope_uq').on(
      t.organizationId,
      t.ruleType,
      sql`coalesce(${t.scopeNodeId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    index('policy_draft_rule_idx').on(t.ruleType),
    index('policy_draft_updated_idx').on(t.updatedAtUtc),
  ],
);
