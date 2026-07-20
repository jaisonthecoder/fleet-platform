import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  activatePolicy,
  fetchPolicyCatalog,
  fetchPolicyFacts,
  fetchPolicyWorkspace,
  savePolicyDraft,
  simulatePolicy,
  type AuthoredDecisionTable,
  type PolicyRuleType,
} from '../policy.contract'

/** Loads the governed policy catalogue. */
export function usePolicyCatalog() {
  return useQuery({ queryKey: ['policies'], queryFn: fetchPolicyCatalog, staleTime: 30_000 })
}

/** Loads typed fact/operator metadata that drives safe authoring controls. */
export function usePolicyFacts() {
  return useQuery({ queryKey: ['policies', 'facts'], queryFn: fetchPolicyFacts, staleTime: 5 * 60_000 })
}

/** Loads active and draft policy state for one rule type. */
export function usePolicyWorkspace(ruleType: PolicyRuleType | null, scopeNodeId?: string | null) {
  return useQuery({
    queryKey: ['policies', ruleType, scopeNodeId ?? 'default'],
    queryFn: () => fetchPolicyWorkspace(ruleType as PolicyRuleType, scopeNodeId),
    enabled: Boolean(ruleType),
  })
}

/** Saves an optimistic policy draft and refreshes its workspace/catalog status. */
export function useSavePolicyDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ruleType, table, expectedRevision, scopeNodeId }: { ruleType: PolicyRuleType; table: AuthoredDecisionTable; expectedRevision: number; scopeNodeId?: string | null }) =>
      savePolicyDraft(ruleType, table, expectedRevision, scopeNodeId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['policies'] })
      void queryClient.invalidateQueries({ queryKey: ['policies', variables.ruleType] })
    },
  })
}

/** Runs a side-effect-free draft simulation. */
export function useSimulatePolicy() {
  return useMutation({
    mutationFn: ({ ruleType, table, context }: { ruleType: PolicyRuleType; table: AuthoredDecisionTable; context: Record<string, unknown> }) =>
      simulatePolicy(ruleType, table, context),
  })
}

/** Activates a persisted draft and refreshes policy projections. */
export function useActivatePolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ruleType, scopeNodeId }: { ruleType: PolicyRuleType; scopeNodeId?: string | null }) => activatePolicy(ruleType, scopeNodeId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['policies'] })
      void queryClient.invalidateQueries({ queryKey: ['policies', variables.ruleType] })
    },
  })
}
