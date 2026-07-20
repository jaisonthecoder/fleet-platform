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
  mode: domainDecisionModeSchema.optional(),
  request: policyEvaluationRequestSchema.extend({
    organizationId: z.string().uuid(),
    scopeNodeId: z.string().uuid(),
    effectiveAtUtc: z.string().datetime(),
  }),
});
export type DomainDecisionRequest = z.infer<typeof domainDecisionRequestSchema>;

export const decisionProvenanceSchema = z.object({
  decisionKey: z.string(),
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