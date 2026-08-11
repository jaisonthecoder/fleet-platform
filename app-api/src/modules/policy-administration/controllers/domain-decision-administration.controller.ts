import { BadRequestException, Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  decisionComparisonSummaryQuerySchema,
  decisionSelectorScopeSchema,
  updateDecisionSelectorSchema,
} from '../../../contracts/domain-decision.contract';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';
import { HierarchyService } from '../../platform/services/hierarchy.service';
import { DomainDecisionAdministrationService } from '../services/domain-decision-administration.service';

const actorRef = (principal: Principal): string => principal.personId ?? principal.entraObjectId ?? 'system-admin';

/** Guarded selector control and privacy-safe parity evidence for INT-2 operations. */
@Controller({ path: 'admin/decision-runtime', version: '1' })
export class DomainDecisionAdministrationController {
  constructor(
    private readonly administration: DomainDecisionAdministrationService,
    private readonly scopeAuthorization: ScopeAuthorizationService,
    private readonly hierarchy: HierarchyService,
  ) {}

  /** Returns one exact selector and its effective inherited configuration. */
  @Roles('SystemAdmin')
  @Get('selectors/:decisionKey')
  async selector(
    @Param('decisionKey') decisionKey: string,
    @Query() query: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = decisionSelectorScopeSchema.safeParse(query);
    if (!parsed.success) throw this.invalid(parsed.error.issues.map((issue) => issue.message));
    await this.assertScope(principal, parsed.data.scopeNodeId ?? null, ['SystemAdmin']);
    return this.administration.selectorState(principal.organizationId, decisionKey, parsed.data.environment, parsed.data.scopeNodeId ?? null);
  }

  /** Updates one exact selector through optimistic revision control. */
  @Roles('SystemAdmin')
  @Patch('selectors/:decisionKey')
  async updateSelector(
    @Param('decisionKey') decisionKey: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = updateDecisionSelectorSchema.safeParse(body);
    if (!parsed.success) throw this.invalid(parsed.error.issues.map((issue) => issue.message));
    await this.assertScope(principal, parsed.data.scopeNodeId ?? null, ['SystemAdmin']);
    return this.administration.updateSelector(principal.organizationId, decisionKey, parsed.data, actorRef(principal));
  }

  /** Returns aggregate comparison categories only; raw comparison records remain private. */
  @Roles('SystemAdmin', 'InternalAudit')
  @Get('comparisons/summary')
  async comparisonSummary(
    @Query() query: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = decisionComparisonSummaryQuerySchema.safeParse(query);
    if (!parsed.success) throw this.invalid(parsed.error.issues.map((issue) => issue.message));
    const roles = ['SystemAdmin', 'InternalAudit'] as const;
    await this.assertScope(principal, parsed.data.scopeNodeId ?? null, roles);
    const authorizedScopes = parsed.data.scopeNodeId
      ? await this.hierarchy.scopeSubtree(parsed.data.scopeNodeId, principal.organizationId)
      : null;
    return this.administration.comparisonSummary(principal.organizationId, parsed.data, authorizedScopes);
  }

  /** Requires an allowed role at the requested scope or at the organization root. */
  private async assertScope(
    principal: Principal,
    scopeNodeId: string | null,
    roles: readonly ('SystemAdmin' | 'InternalAudit')[],
  ): Promise<void> {
    if (scopeNodeId) await this.scopeAuthorization.assertRolesAtScope(principal, roles, scopeNodeId);
    else await this.scopeAuthorization.assertRootRole(principal, roles);
  }

  /** Creates one stable RFC-7807 validation error. */
  private invalid(reasons: string[]): BadRequestException {
    return new BadRequestException({ title: 'Invalid decision runtime request', reasons });
  }
}