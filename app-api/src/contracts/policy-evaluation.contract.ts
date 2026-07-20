import { z } from 'zod';

/** PDP decision outcomes (mirrors the design contract). */
export const policyDecisionSchema = z.enum([
  'ALLOW',
  'DENY',
  'ROUTE_TO',
  'VALUE',
]);
export type PolicyDecision = z.infer<typeof policyDecisionSchema>;

/** Scope level that answered the evaluation (hierarchy inheritance). */
export const policyScopeSchema = z.enum(['group', 'cluster', 'pool']);

export const policyEvaluationRequestSchema = z.object({
  organizationId: z.string().uuid().optional(),
  scopeNodeId: z.string().uuid().optional(),
  effectiveAtUtc: z.string().datetime().optional(),
  ruleType: z.string().min(1),
  context: z.record(z.string(), z.unknown()),
});

export type PolicyEvaluationRequest = z.infer<
  typeof policyEvaluationRequestSchema
>;

export const policyEvaluationResponseSchema = z.object({
  decision: policyDecisionSchema,
  reasons: z.array(z.string()),
  policyVersion: z.string(),
  policyRuleId: z.string().uuid().nullable().optional(),
  policyVersionId: z.string().uuid().nullable().optional(),
  matchedRowId: z.string().nullable().optional(),
  scopeThatAnswered: policyScopeSchema,
  requestedScopeNodeId: z.string().uuid().nullable().optional(),
  resolvedScopeNodeId: z.string().uuid().nullable().optional(),
  /** Present when decision === 'ROUTE_TO' (the resolved approval chain). */
  route: z.array(z.string()).optional(),
  /** Present when decision === 'VALUE' (a configured value, e.g. buffer minutes). */
  value: z.unknown().optional(),
});

export type PolicyEvaluationResponse = z.infer<
  typeof policyEvaluationResponseSchema
>;
