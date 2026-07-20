import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, FlaskConical, Plus, Save, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/patterns/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusChip } from '@/components/ui/status-chip'
import { useConfirm } from '@/hooks/use-confirm'
import { notify } from '@/hooks/use-toast'
import { ApiRequestError } from '@/lib/api-client'
import { useHierarchy } from '@/features/platform/hooks/use-hierarchy'
import { flattenHierarchy } from '@/features/platform/platform.contract'
import {
  type AuthoredDecisionRow,
  type AuthoredDecisionTable,
  type DecisionOperator,
  type PolicyDecision,
  type PolicyFactDefinition,
  type PolicyRuleType,
  type RuntimeDecisionTable,
} from './policy.contract'
import {
  useActivatePolicy,
  usePolicyCatalog,
  usePolicyFacts,
  usePolicyWorkspace,
  useSavePolicyDraft,
  useSimulatePolicy,
} from './hooks/use-policies'

const DECISIONS: PolicyDecision[] = ['ALLOW', 'DENY', 'VALUE', 'ROUTE_TO']
const EMPTY_FACTS: PolicyFactDefinition[] = []
const operatorLabels: Record<DecisionOperator, string> = {
  eq: '=', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=', in: 'in', notIn: 'not in',
}

/** Converts current compact runtime rows into the policy studio's authored shape. */
function toAuthored(ruleType: PolicyRuleType, active: RuntimeDecisionTable | null): AuthoredDecisionTable {
  if (!active) {
    return {
      schemaVersion: 1,
      ruleType,
      version: 'draft-v1',
      scope: 'group',
      rows: [],
      default: { decision: 'DENY', reasons: ['policy-default-deny'] },
    }
  }
  return {
    schemaVersion: 1,
    ruleType,
    version: `${active.version}-draft`,
    scope: active.scope,
    rows: active.rows.map((row, rowIndex) => ({
      id: row.id ?? `row-${rowIndex + 1}`,
      conditions: row.conditions ?? Object.entries(row.when ?? {}).map(([fact, expected], conditionIndex) => {
        if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
          const comparison = expected as Record<string, unknown>
          const operator = ('gte' in comparison ? 'gte' : 'lte') as DecisionOperator
          return { id: `condition-${rowIndex + 1}-${conditionIndex + 1}`, fact, operator, value: comparison[operator] }
        }
        return { id: `condition-${rowIndex + 1}-${conditionIndex + 1}`, fact, operator: 'eq' as const, value: expected }
      }),
      decision: row.decision,
      reasons: row.reasons,
      route: row.route,
      value: row.value,
    })),
    default: active.default,
  }
}

/** Creates a type-compatible initial value for a newly selected fact. */
function initialValue(fact: PolicyFactDefinition): unknown {
  if (fact.allowedValues?.length) return fact.allowedValues[0]
  if (fact.dataType === 'boolean') return false
  if (fact.dataType === 'number') return 0
  return ''
}

/** Parses an editable value while preserving its fact type. */
function parseValue(fact: PolicyFactDefinition, raw: string): unknown {
  if (fact.dataType === 'number') return Number(raw)
  if (fact.dataType === 'boolean') return raw === 'true'
  if (fact.operators.includes('in') && raw.includes(',')) return raw.split(',').map((value) => value.trim()).filter(Boolean)
  return raw
}

/** Selects the first fact not already used by the current rule. */
function nextFact(
  facts: PolicyFactDefinition[],
  conditions: AuthoredDecisionRow['conditions'],
): PolicyFactDefinition | undefined {
  const used = new Set(conditions.map((condition) => condition.fact))
  return facts.find((fact) => !used.has(fact.key)) ?? facts[0]
}

/** Presents a typed rule output as editable text. */
function formatOutcome(row: Pick<AuthoredDecisionRow, 'decision' | 'route' | 'value'>): string {
  if (row.decision === 'ROUTE_TO') return row.route?.join(', ') ?? ''
  if (row.decision !== 'VALUE') return ''
  return typeof row.value === 'string' ? row.value : JSON.stringify(row.value ?? '')
}

/** Parses an outcome editor value into the selected decision family. */
function parseOutcome(decision: PolicyDecision, raw: string): { route?: string[]; value?: unknown } {
  if (decision === 'ROUTE_TO') {
    return { route: raw.split(',').map((value) => value.trim()).filter(Boolean) }
  }
  if (decision !== 'VALUE') return {}
  try { return { value: JSON.parse(raw) as unknown } }
  catch { return { value: raw } }
}

/** Policy Studio: governed rule catalogue, dynamic conditions, simulation and activation. */
export function PolicyStudioPage() {
  const { t, i18n } = useTranslation()
  const confirm = useConfirm()
  const catalog = usePolicyCatalog()
  const factsQuery = usePolicyFacts()
  const [selected, setSelected] = useState<PolicyRuleType | null>(null)
  const [policyScopeId, setPolicyScopeId] = useState<string | null>(null)
  const hierarchy = useHierarchy()
  const scopeOptions = useMemo(
    () => flattenHierarchy(hierarchy.data ?? []),
    [hierarchy.data],
  )
  const workspace = usePolicyWorkspace(selected, policyScopeId)
  const saveDraft = useSavePolicyDraft()
  const simulate = useSimulatePolicy()
  const activate = useActivatePolicy()
  const [table, setTable] = useState<AuthoredDecisionTable | null>(null)
  const [revision, setRevision] = useState(0)
  const [testContext, setTestContext] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!selected && catalog.data?.[0]) setSelected(catalog.data[0].ruleType)
  }, [catalog.data, selected])

  useEffect(() => {
    if (!workspace.data || !selected) return
    const next = workspace.data.draft?.table ?? toAuthored(selected, workspace.data.active)
    setTable(next)
    setRevision(workspace.data.draft?.revision ?? 0)
    setTestContext(Object.fromEntries(next.rows.flatMap((row) => row.conditions.map((condition) => [condition.fact, condition.value]))))
  }, [workspace.data, selected])

  const facts = factsQuery.data ?? EMPTY_FACTS
  const factByKey = useMemo(() => new Map(facts.map((fact) => [fact.key, fact])), [facts])
  const isArabic = i18n.language.startsWith('ar')

  const reportError = (error: unknown, fallback: string) => {
    if (error instanceof ApiRequestError) notify.danger(error.message || fallback, { description: error.reasons?.join(' · ') })
    else notify.danger(fallback)
  }

  const updateRow = (rowIndex: number, update: (row: AuthoredDecisionRow) => AuthoredDecisionRow) => {
    if (!table) return
    setTable({ ...table, rows: table.rows.map((row, index) => index === rowIndex ? update(row) : row) })
  }

  const addRule = () => {
    if (!table || !facts[0]) return
    const fact = facts[0]
    setTable({
      ...table,
      rows: [...table.rows, {
        id: crypto.randomUUID(),
        conditions: [{ id: crypto.randomUUID(), fact: fact.key, operator: fact.operators[0], value: initialValue(fact) }],
        decision: 'ALLOW',
        reasons: ['policy-rule-match'],
      }],
    })
  }

  const save = async () => {
    if (!table || !selected) return
    try {
      const result = await saveDraft.mutateAsync({ ruleType: selected, table, expectedRevision: revision, scopeNodeId: policyScopeId })
      setRevision(result.revision)
      notify.ok(t('policyStudio.saved'))
    } catch (error) { reportError(error, t('policyStudio.saveFailed')) }
  }

  const runSimulation = async () => {
    if (!table || !selected) return
    try { await simulate.mutateAsync({ ruleType: selected, table, context: testContext }) }
    catch (error) { reportError(error, t('policyStudio.simulationFailed')) }
  }

  const activateDraft = async () => {
    if (!selected || revision === 0) return
    const approved = await confirm({
      title: t('policyStudio.activateTitle'),
      description: t('policyStudio.activateDescription'),
      confirmLabel: t('policyStudio.activate'),
    })
    if (!approved) return
    try { await activate.mutateAsync({ ruleType: selected, scopeNodeId: policyScopeId }); setRevision(0); notify.ok(t('policyStudio.activated')) }
    catch (error) { reportError(error, t('policyStudio.activateFailed')) }
  }

  if (catalog.isLoading || factsQuery.isLoading || hierarchy.isLoading) return <div className="h-64 animate-pulse rounded-[3px] bg-card" />
  if (catalog.isError || factsQuery.isError || hierarchy.isError) return <EmptyState title={t('policyStudio.loadFailed')} description={t('policyStudio.loadFailedBody')} action={<Button onClick={() => { void catalog.refetch(); void factsQuery.refetch(); void hierarchy.refetch() }}>{t('common.retry')}</Button>} />

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t('policyStudio.eyebrow')} title={t('policyStudio.title')} description={t('policyStudio.description')} />
      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[260px_minmax(520px,1fr)_300px]">
        <aside className="max-h-72 overflow-y-auto rounded-[3px] border border-border bg-card xl:max-h-[720px]">
          <div className="border-b border-border px-4 py-3"><p className="eyebrow">{t('policyStudio.catalog')}</p></div>
          <div className="divide-y divide-border">
            {catalog.data?.map((item) => (
              <button key={item.ruleType} type="button" onClick={() => { simulate.reset(); setSelected(item.ruleType) }} className={`w-full px-4 py-3 text-start transition-colors ${selected === item.ruleType ? 'bg-brand-soft' : 'hover:bg-surface-hover'}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-bold">{item.ruleType}</span><StatusChip tone={item.status === 'Draft' ? 'warn' : 'ok'} label={item.status} /></div>
                <div className="mt-1 font-data text-[11px] text-muted-foreground">{item.activeVersion ?? t('policyStudio.notConfigured')}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="rounded-[3px] border border-border bg-card">
          {!table || workspace.isLoading ? <div className="h-full animate-pulse bg-surface-2" /> : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div><p className="eyebrow">{table.ruleType} · {table.version}</p><h2 className="mt-1 text-lg font-bold">{t('policyStudio.editor')}</h2></div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={policyScopeId ?? 'organization-default'} onValueChange={(value) => { simulate.reset(); setPolicyScopeId(value === 'organization-default' ? null : value) }}>
                    <SelectTrigger className="w-[220px]" aria-label={t('policyStudio.policyScope')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organization-default">{t('policyStudio.organizationDefault')}</SelectItem>
                      {scopeOptions.map((node) => <SelectItem key={node.id} value={node.id}>{'— '.repeat(node.depth)}{node.levelLabel} · {node.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" onClick={save} disabled={saveDraft.isPending}><Save />{t('policyStudio.saveDraft')}</Button>
                  <Button onClick={activateDraft} disabled={revision === 0 || activate.isPending}><Upload />{t('policyStudio.activate')}</Button>
                </div>
              </div>
              <div className="space-y-5 p-5">
                {table.rows.map((row, rowIndex) => (
                  <section key={row.id} className="rounded-[3px] border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-2"><span className="eyebrow">{t('policyStudio.rule')} {rowIndex + 1}</span><Button variant="ghost" size="icon" aria-label={t('policyStudio.removeRule')} onClick={() => setTable({ ...table, rows: table.rows.filter((_, index) => index !== rowIndex) })}><Trash2 /></Button></div>
                    <div className="space-y-2 p-3">
                      {row.conditions.map((condition, conditionIndex) => {
                        const fact = factByKey.get(condition.fact) ?? facts[0]
                        if (!fact) return null
                        return (
                          <div key={condition.id} className="grid items-center gap-2 md:grid-cols-[46px_minmax(180px,1fr)_110px_minmax(140px,0.8fr)_40px]">
                            <span className="text-[11px] font-bold text-signal-strong">{conditionIndex === 0 ? 'IF' : 'AND'}</span>
                            <Select
                              value={condition.fact}
                              onValueChange={(factKey) => {
                                const nextFact = factByKey.get(factKey)
                                if (!nextFact) return
                                updateRow(rowIndex, (current) => ({
                                  ...current,
                                  conditions: current.conditions.map((item) =>
                                    item.id === condition.id
                                      ? {
                                          ...item,
                                          fact: factKey,
                                          operator: nextFact.operators[0],
                                          value: initialValue(nextFact),
                                        }
                                      : item,
                                  ),
                                }))
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {facts.map((option) => (
                                  <SelectItem key={option.key} value={option.key}>
                                    {isArabic ? option.labelAr : option.labelEn}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={condition.operator} onValueChange={(operator) => updateRow(rowIndex, (current) => ({ ...current, conditions: current.conditions.map((item) => item.id === condition.id ? { ...item, operator: operator as DecisionOperator } : item) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fact.operators.map((operator) => <SelectItem key={operator} value={operator}>{operatorLabels[operator]}</SelectItem>)}</SelectContent></Select>
                            <FactValue fact={fact} value={condition.value} onChange={(value) => updateRow(rowIndex, (current) => ({ ...current, conditions: current.conditions.map((item) => item.id === condition.id ? { ...item, value } : item) }))} />
                            <Button variant="ghost" size="icon" aria-label={t('policyStudio.removeCondition')} onClick={() => updateRow(rowIndex, (current) => ({ ...current, conditions: current.conditions.filter((item) => item.id !== condition.id) }))}><Trash2 /></Button>
                          </div>
                        )
                      })}
                      <Button variant="secondary" size="sm" onClick={() => { const fact = nextFact(facts, row.conditions); if (!fact) return; updateRow(rowIndex, (current) => ({ ...current, conditions: [...current.conditions, { id: crypto.randomUUID(), fact: fact.key, operator: fact.operators[0], value: initialValue(fact) }] })) }}><Plus />{t('policyStudio.addCondition')}</Button>
                      <div className="grid gap-2 border-t border-border pt-3 md:grid-cols-[120px_1fr_1fr]"><Select value={row.decision} onValueChange={(decision) => updateRow(rowIndex, (current) => ({ ...current, decision: decision as PolicyDecision, route: undefined, value: undefined }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DECISIONS.map((decision) => <SelectItem key={decision} value={decision}>{decision}</SelectItem>)}</SelectContent></Select><Input value={row.reasons.join(', ')} onChange={(event) => updateRow(rowIndex, (current) => ({ ...current, reasons: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))} aria-label={t('policyStudio.reasons')} />{row.decision === 'VALUE' || row.decision === 'ROUTE_TO' ? <Input aria-label={t('policyStudio.outcome')} value={formatOutcome(row)} onChange={(event) => updateRow(rowIndex, (current) => ({ ...current, ...parseOutcome(current.decision, event.target.value) }))} /> : <span />}</div>
                    </div>
                  </section>
                ))}
                <Button variant="secondary" onClick={addRule}><Plus />{t('policyStudio.addRule')}</Button>
                <section className="rounded-[3px] border border-dashed border-border bg-surface-2 p-4"><p className="eyebrow mb-2">{t('policyStudio.default')}</p><div className="grid gap-2 md:grid-cols-[140px_1fr_1fr]"><Select value={table.default.decision} onValueChange={(decision) => setTable({ ...table, default: { ...table.default, decision: decision as PolicyDecision, route: undefined, value: undefined } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DECISIONS.map((decision) => <SelectItem key={decision} value={decision}>{decision}</SelectItem>)}</SelectContent></Select><Input value={table.default.reasons.join(', ')} onChange={(event) => setTable({ ...table, default: { ...table.default, reasons: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) } })} />{table.default.decision === 'VALUE' || table.default.decision === 'ROUTE_TO' ? <Input aria-label={t('policyStudio.defaultOutcome')} value={formatOutcome(table.default)} onChange={(event) => setTable({ ...table, default: { ...table.default, ...parseOutcome(table.default.decision, event.target.value) } })} /> : <span />}</div></section>
              </div>
            </>
          )}
        </main>

        <aside className="rounded-[3px] border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2"><FlaskConical className="size-4 text-brand" /><h2 className="font-bold">{t('policyStudio.test')}</h2></div>
          <div className="space-y-3">{table && [...new Set(table.rows.flatMap((row) => row.conditions.map((condition) => condition.fact)))].map((factKey) => { const fact = factByKey.get(factKey); if (!fact) return null; return <label key={factKey} className="block"><span className="mb-1 block text-xs font-bold">{isArabic ? fact.labelAr : fact.labelEn}</span><FactValue fact={fact} value={testContext[factKey]} onChange={(value) => setTestContext((current) => ({ ...current, [factKey]: value }))} /></label> })}</div>
          <Button className="mt-4 w-full" variant="signal" onClick={runSimulation} disabled={!table || simulate.isPending}><FlaskConical />{t('policyStudio.runTest')}</Button>
          {simulate.data ? <div className="mt-4 rounded-[3px] border border-brand/20 bg-brand-soft p-4"><div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-brand" /><StatusChip tone={simulate.data.decision === 'DENY' ? 'danger' : 'ok'} label={simulate.data.decision} /></div><p className="mt-3 text-sm font-semibold">{simulate.data.matchedRowId ? t('policyStudio.matched', { id: simulate.data.matchedRowId }) : t('policyStudio.defaultMatched')}</p><p className="mt-1 text-xs text-muted-foreground">{simulate.data.reasons.join(' · ')}</p>{simulate.data.value !== undefined ? <pre className="mt-3 overflow-auto rounded-[2px] bg-card p-2 text-xs">{JSON.stringify(simulate.data.value, null, 2)}</pre> : null}</div> : null}
        </aside>
      </div>
    </div>
  )
}

function FactValue({ fact, value, onChange }: { fact: PolicyFactDefinition; value: unknown; onChange: (value: unknown) => void }) {
  if (fact.allowedValues?.length) return <Select value={String(value)} onValueChange={(raw) => onChange(parseValue(fact, raw))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fact.allowedValues.map((option) => <SelectItem key={String(option)} value={String(option)}>{String(option)}</SelectItem>)}</SelectContent></Select>
  return <Input type={fact.dataType === 'number' ? 'number' : 'text'} value={Array.isArray(value) ? value.join(', ') : String(value ?? '')} onChange={(event) => onChange(parseValue(fact, event.target.value))} />
}
