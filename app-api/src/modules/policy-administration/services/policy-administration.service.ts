import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthoredDecisionTable,
  PolicyCatalogItem,
  PolicySimulationResponse,
} from '../../../contracts/policy-authoring.contract';
import {
  POLICY_FACT_CATALOG,
  policyFactDefinitionSchema,
} from '../../../contracts/policy-authoring.contract';
import { POLICY_RULE_TYPES, type PolicyRuleType } from '../../../contracts/policy-rules.contract';
import { AuditService } from '../../platform/services/audit.service';
import { evaluateTableWithTrace } from '../../policy/internal/decision-table';
import { compileAuthoredTable } from '../../policy/internal/policy-compiler';
import { PolicyRegistryService } from '../../policy/internal/policy-registry';
import { PolicyRepository } from '../../policy/repositories/policy.repository';
import { PolicyAdminService } from '../../policy/services/policy-admin.service';
import { PolicyDraftRepository } from '../repositories/policy-draft.repository';

@Injectable()
export class PolicyAdministrationService {
  constructor(
    private readonly drafts: PolicyDraftRepository,
    private readonly registry: PolicyRegistryService,
    private readonly policies: PolicyRepository,
    private readonly admin: PolicyAdminService,
    private readonly audit: AuditService,
  ) {}

  /** Returns normalized bilingual metadata that drives policy-studio controls. */
  facts() {
    return POLICY_FACT_CATALOG.map((fact) => policyFactDefinitionSchema.parse(fact));
  }

  /** Lists every governed rule type with active and draft version status. */
  async list(organizationId: string): Promise<PolicyCatalogItem[]> {
    const drafts = new Map(
      (await this.drafts.list(organizationId))
        .filter((draft) => draft.scopeNodeId === null)
        .map((draft) => [draft.ruleType, draft]),
    );
    return Promise.all(
      POLICY_RULE_TYPES.map(async (ruleType) => {
        const active =
          (await this.policies.loadActiveTable(ruleType, organizationId))?.table ??
          this.registry.getActive(ruleType) ??
          null;
        const draft = drafts.get(ruleType);
        return {
          ruleType,
          activeVersion: active?.version ?? null,
          draftRevision: draft?.revision ?? null,
          status: draft ? 'Draft' : 'Configured',
        } satisfies PolicyCatalogItem;
      }),
    );
  }

  /** Returns the active table and mutable draft workspace for one rule type. */
  async get(
    organizationId: string,
    ruleType: PolicyRuleType,
    scopeNodeId?: string | null,
  ) {
    const active =
      (await this.policies.loadActiveTable(
        ruleType,
        organizationId,
        scopeNodeId,
      ))?.table ??
      this.registry.getActive(ruleType) ??
      null;
    const draft = await this.drafts.find(organizationId, ruleType, scopeNodeId);
    return {
      ruleType,
      scopeNodeId: scopeNodeId ?? null,
      active,
      draft: draft
        ? {
            id: draft.id,
            revision: draft.revision,
            table: draft.authoredDefinition as AuthoredDecisionTable,
            createdBy: draft.createdBy,
            updatedAtUtc: draft.updatedAtUtc.toISOString(),
          }
        : null,
    };
  }

  /** Validates, compiles, and optimistically persists a policy-studio draft. */
  async saveDraft(
    organizationId: string,
    ruleType: PolicyRuleType,
    scopeNodeId: string | null | undefined,
    table: AuthoredDecisionTable,
    expectedRevision: number,
    actorRef: string,
  ) {
    if (table.ruleType !== ruleType) {
      throw new NotFoundException({
        title: 'Policy rule type mismatch',
        reasons: [`policy-rule-type-mismatch:${ruleType}:${table.ruleType}`],
      });
    }
    compileAuthoredTable(table);
    const saved = await this.drafts.save(
      organizationId,
      ruleType,
      scopeNodeId,
      table,
      expectedRevision,
      actorRef,
    );
    await this.audit.record({
      actorRef,
      action: 'POLICY_DRAFT_SAVED',
      organizationId,
      entityRef: `policy:${ruleType}:${scopeNodeId ?? 'default'}`,
      after: { revision: saved.revision, version: table.version, scopeNodeId: scopeNodeId ?? null },
    });
    return { id: saved.id, revision: saved.revision, scopeNodeId: scopeNodeId ?? null, table };
  }

  /** Simulates an authored draft without logging, escalation, cache, or effects. */
  simulate(table: AuthoredDecisionTable, context: Record<string, unknown>): PolicySimulationResponse {
    const compiled = compileAuthoredTable(table);
    const result = evaluateTableWithTrace(compiled, context);
    return { ...result.response, matchedRowId: result.matchedRowId };
  }

  /** Activates the persisted draft atomically and removes only the working copy. */
  async activate(
    organizationId: string,
    ruleType: PolicyRuleType,
    scopeNodeId: string | null | undefined,
    actorRef: string,
  ) {
    const draft = await this.drafts.find(organizationId, ruleType, scopeNodeId);
    if (!draft) {
      throw new NotFoundException({
        title: 'Policy draft not found',
        reasons: [`policy-draft-not-found:${ruleType}`],
      });
    }
    const table = draft.authoredDefinition as AuthoredDecisionTable;
    const compiled = compileAuthoredTable(table);
    await this.admin.activate(compiled, organizationId, scopeNodeId);
    await this.drafts.remove(organizationId, ruleType, scopeNodeId);
    await this.audit.record({
      actorRef,
      action: 'POLICY_ACTIVATED',
      organizationId,
      entityRef: `policy:${ruleType}:${scopeNodeId ?? 'default'}`,
      after: { version: table.version, draftRevision: draft.revision, scopeNodeId: scopeNodeId ?? null },
    });
    return { ruleType, version: table.version, scopeNodeId: scopeNodeId ?? null, status: 'Active' as const };
  }
}
