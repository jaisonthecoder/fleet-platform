import { z } from 'zod';
import {
  policyDecisionSchema,
  policyEvaluationRequestSchema,
  policyEvaluationResponseSchema,
} from './policy-evaluation.contract';

export const domainDecisionModeSchema = z.enum([
  'legacy-only',
  'shadow',
  'new-canary',
  'new-primary-with-legacy-shadow',
  'new-only',
]);
export type DomainDecisionMode = z.infer<typeof domainDecisionModeSchema>;

export const domainDecisionRequestSchema = z.object({
  consumer: z.string().min(1),
  subjectRef: z.string().min(1),
  correlationId: z.string().min(1),
  environment: z.string().min(1).optional(),
  timeoutMs: z.number().int().min(10).max(5000).optional(),
  request: policyEvaluationRequestSchema.extend({
    organizationId: z.string().uuid(),
    scopeNodeId: z.string().uuid(),
    effectiveAtUtc: z.string().datetime(),
  }),
});
export type DomainDecisionRequest = z.infer<typeof domainDecisionRequestSchema>;

export const decisionProvenanceSchema = z.object({
  decisionKey: z.string(),
  environment: z.string().min(1),
  selectorId: z.string().uuid().nullable(),
  selectorRevision: z.number().int().positive().nullable(),
  deploymentId: z.string().uuid().nullable(),
  consumer: z.string(),
  subjectRef: z.string(),
  correlationId: z.string(),
  organizationId: z.string().uuid(),
  requestedScopeNodeId: z.string().uuid(),
  resolvedScopeNodeId: z.string().uuid().nullable(),
  policyVersion: z.string(),
  policyRuleId: z.string().uuid().nullable(),
  policyVersionId: z.string().uuid().nullable(),
  matchedRowId: z.string().nullable(),
  decision: policyDecisionSchema,
  reasons: z.array(z.string()),
  effectiveAtUtc: z.string().datetime(),
  evaluatedAtUtc: z.string().datetime(),
  factFingerprint: z.string(),
  mode: domainDecisionModeSchema,
  source: z.enum(['legacy', 'new']),
  degraded: z.boolean(),
});
export type DecisionProvenance = z.infer<typeof decisionProvenanceSchema>;

export const domainDecisionResultSchema = z.object({
  response: policyEvaluationResponseSchema,
  provenance: decisionProvenanceSchema,
});
export type DomainDecisionResult = z.infer<typeof domainDecisionResultSchema>;

export const decisionSelectorScopeSchema = z.object({
  environment: z.string().trim().min(1).max(50).default('default'),
  scopeNodeId: z.string().uuid().nullable().optional(),
});

export const updateDecisionSelectorSchema = decisionSelectorScopeSchema.extend({
  mode: domainDecisionModeSchema,
  canaryPercentage: z.number().int().min(0).max(100).default(0),
  comparisonSamplePercentage: z.number().int().min(0).max(100).default(100),
  expectedRevision: z.number().int().nonnegative(),
});
export type UpdateDecisionSelector = z.infer<typeof updateDecisionSelectorSchema>;

export const decisionComparisonSummaryQuerySchema = decisionSelectorScopeSchema.extend({
  decisionKey: z.string().trim().min(1).max(120),
  sinceUtc: z.string().datetime().optional(),
});
export type DecisionComparisonSummaryQuery = z.infer<typeof decisionComparisonSummaryQuerySchema>;

export interface DecisionSelectorStateDto {
  configured: {
    id: string;
    revision: number;
    scopeNodeId: string | null;
    environment: string;
    mode: DomainDecisionMode;
    canaryPercentage: number;
    comparisonSamplePercentage: number;
  } | null;
  effective: {
    id: string | null;
    revision: number | null;
    mode: DomainDecisionMode;
    canaryPercentage: number;
    comparisonSamplePercentage: number;
  };
}

export interface DecisionComparisonSummaryDto {
  decisionKey: string;
  environment: string;
  sinceUtc: string;
  total: number;
  counts: Array<{ mode: DomainDecisionMode; category: string; count: number }>;
}