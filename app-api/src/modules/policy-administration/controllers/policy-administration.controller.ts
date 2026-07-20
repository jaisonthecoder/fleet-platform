import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  policySimulationRequestSchema,
  savePolicyDraftSchema,
} from '../../../contracts/policy-authoring.contract';
import { policyRuleTypeSchema, type PolicyRuleType } from '../../../contracts/policy-rules.contract';
import { PolicyAdministrationService } from '../services/policy-administration.service';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';

const actorRef = (principal: Principal): string =>
  principal.personId ?? principal.entraObjectId ?? 'system-admin';

@Roles('SystemAdmin')
@Controller({ path: 'admin/policies', version: '1' })
export class PolicyAdministrationController {
  constructor(
    private readonly policies: PolicyAdministrationService,
    private readonly scopeAuthorization: ScopeAuthorizationService,
  ) {}

  /** Returns the fact/operator metadata used to build safe dynamic controls. */
  @Get('facts')
  facts() {
    return this.policies.facts();
  }

  /** Lists governed policies with active and draft status. */
  @Get()
  list(@CurrentUser() principal: Principal) {
    return this.policies.list(principal.organizationId);
  }

  /** Returns the active/draft workspace for one governed policy. */
  @Get(':ruleType')
  async get(
    @Param('ruleType') ruleType: string,
    @Query('scopeNodeId') scopeNodeId: string | undefined,
    @CurrentUser() principal: Principal,
  ) {
    await this.assertPolicyScope(principal, scopeNodeId);
    return this.policies.get(
      principal.organizationId,
      this.parseRuleType(ruleType),
      scopeNodeId,
    );
  }

  /** Validates and saves an optimistic policy draft. */
  @Post(':ruleType/draft')
  async saveDraft(
    @Param('ruleType') ruleType: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = savePolicyDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid policy draft',
        reasons: parsed.error.issues.map((issue) => issue.message),
      });
    }
    await this.assertPolicyScope(principal, parsed.data.scopeNodeId ?? undefined);
    return this.policies.saveDraft(
      principal.organizationId,
      this.parseRuleType(ruleType),
      parsed.data.scopeNodeId,
      parsed.data.table,
      parsed.data.expectedRevision,
      actorRef(principal),
    );
  }

  /** Simulates a draft without production audit, escalation, or effects. */
  @Post(':ruleType/simulate')
  simulate(@Param('ruleType') ruleType: string, @Body() body: unknown) {
    const parsed = policySimulationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid policy simulation',
        reasons: parsed.error.issues.map((issue) => issue.message),
      });
    }
    const parsedRuleType = this.parseRuleType(ruleType);
    if (parsed.data.table.ruleType !== parsedRuleType) {
      throw new BadRequestException({
        title: 'Policy rule type mismatch',
        reasons: [`policy-rule-type-mismatch:${parsedRuleType}:${parsed.data.table.ruleType}`],
      });
    }
    return this.policies.simulate(parsed.data.table, parsed.data.context);
  }

  /** Activates the current draft through the transactional PAP write service. */
  @Post(':ruleType/activate')
  async activate(
    @Param('ruleType') ruleType: string,
    @Query('scopeNodeId') scopeNodeId: string | undefined,
    @CurrentUser() principal: Principal,
  ) {
    await this.assertPolicyScope(principal, scopeNodeId);
    return this.policies.activate(
      principal.organizationId,
      this.parseRuleType(ruleType),
      scopeNodeId,
      actorRef(principal),
    );
  }

  /** Parses a route parameter into the governed policy rule vocabulary. */
  private parseRuleType(value: string): PolicyRuleType {
    const parsed = policyRuleTypeSchema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Unknown policy rule type',
        reasons: [`unknown-policy-rule-type:${value}`],
      });
    }
    return parsed.data;
  }

  /** Requires SystemAdmin authority over an exact policy scope or organization root. */
  private async assertPolicyScope(
    principal: Principal,
    scopeNodeId?: string,
  ): Promise<void> {
    if (scopeNodeId) {
      await this.scopeAuthorization.assertRolesAtScope(
        principal,
        ['SystemAdmin'],
        scopeNodeId,
      );
    } else {
      await this.scopeAuthorization.assertRootRole(principal, ['SystemAdmin']);
    }
  }
}
