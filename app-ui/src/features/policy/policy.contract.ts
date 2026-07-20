import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

export const POLICY_RULE_TYPES = [
  'booking-buffer',
  'driver-eligibility',
  'max-booking-duration',
  'booking-approval-chain',
  'entitlement-approval-chain',
  'dedicated-vehicle-eligibility',
  'driver-eligibility-gate',
  'compliance-alert-ladders',
  'hard-block-conditions',
  'fines-hr-threshold',
  'black-point-timeframe',
  'consent-re-consent-tolerance',
  'fuel-deviation-threshold',
] as const
export const policyRuleTypeSchema = z.enum(POLICY_RULE_TYPES)
export type PolicyRuleType = z.infer<typeof policyRuleTypeSchema>

export const DECISION_OPERATORS = [
  'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'notIn',
] as const
export type DecisionOperator = (typeof DECISION_OPERATORS)[number]

export interface PolicyFactDefinition {
  key: string
  labelEn: string
  labelAr: string
  descriptionEn: string
  descriptionAr: string
  dataType: 'boolean' | 'number' | 'string' | 'enum'
  operators: DecisionOperator[]
  unit?: string
  allowedValues?: Array<string | number | boolean>
  source: string
  nullable: boolean
  freshnessMinutes?: number
  classification: 'internal' | 'personal' | 'sensitive'
}

export interface AuthoredCondition {
  id: string
  fact: string
  operator: DecisionOperator
  value: unknown
}

export type PolicyDecision = 'ALLOW' | 'DENY' | 'ROUTE_TO' | 'VALUE'

export interface AuthoredDecisionRow {
  id: string
  conditions: AuthoredCondition[]
  decision: PolicyDecision
  reasons: string[]
  route?: string[]
  value?: unknown
}

export interface AuthoredDecisionTable {
  schemaVersion: 1
  ruleType: PolicyRuleType
  version: string
  scope: 'group' | 'cluster' | 'pool'
  rows: AuthoredDecisionRow[]
  default: Omit<AuthoredDecisionRow, 'id' | 'conditions'>
}

export interface PolicyCatalogItem {
  ruleType: PolicyRuleType
  activeVersion: string | null
  draftRevision: number | null
  status: 'Configured' | 'Draft'
}

interface RuntimeRow extends Omit<AuthoredDecisionRow, 'id' | 'conditions'> {
  id?: string
  conditions?: AuthoredCondition[]
  when?: Record<string, unknown>
}

export interface RuntimeDecisionTable extends Omit<AuthoredDecisionTable, 'schemaVersion' | 'rows'> {
  schemaVersion?: 1
  rows: RuntimeRow[]
}

export interface PolicyWorkspace {
  ruleType: PolicyRuleType
  scopeNodeId: string | null
  active: RuntimeDecisionTable | null
  draft: {
    id: string
    revision: number
    table: AuthoredDecisionTable
    createdBy: string
    updatedAtUtc: string
  } | null
}

export interface PolicySimulationResult {
  decision: PolicyDecision
  reasons: string[]
  policyVersion: string
  scopeThatAnswered: 'group' | 'cluster' | 'pool'
  matchedRowId: string | null
  route?: string[]
  value?: unknown
}

export async function fetchPolicyCatalog(): Promise<PolicyCatalogItem[]> {
  return apiClient.get('/v1/admin/policies')
}

export async function fetchPolicyFacts(): Promise<PolicyFactDefinition[]> {
  return apiClient.get('/v1/admin/policies/facts')
}

export async function fetchPolicyWorkspace(ruleType: PolicyRuleType, scopeNodeId?: string | null): Promise<PolicyWorkspace> {
  const query = scopeNodeId ? `?scopeNodeId=${encodeURIComponent(scopeNodeId)}` : ''
  return apiClient.get(`/v1/admin/policies/${ruleType}${query}`)
}

export async function savePolicyDraft(
  ruleType: PolicyRuleType,
  table: AuthoredDecisionTable,
  expectedRevision: number,
  scopeNodeId?: string | null,
): Promise<{ id: string; revision: number; table: AuthoredDecisionTable }> {
  return apiClient.post(`/v1/admin/policies/${ruleType}/draft`, { table, expectedRevision, scopeNodeId: scopeNodeId ?? null })
}

export async function simulatePolicy(
  ruleType: PolicyRuleType,
  table: AuthoredDecisionTable,
  context: Record<string, unknown>,
): Promise<PolicySimulationResult> {
  return apiClient.post(`/v1/admin/policies/${ruleType}/simulate`, { table, context })
}

export async function activatePolicy(
  ruleType: PolicyRuleType,
  scopeNodeId?: string | null,
): Promise<{ ruleType: PolicyRuleType; version: string; status: 'Active' }> {
  const query = scopeNodeId ? `?scopeNodeId=${encodeURIComponent(scopeNodeId)}` : ''
  return apiClient.post(`/v1/admin/policies/${ruleType}/activate${query}`)
}
