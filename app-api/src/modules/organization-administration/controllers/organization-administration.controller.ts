import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  createHierarchyNodeSchema,
  createHierarchyLevelSchema,
  moveHierarchyNodeSchema,
  reactivateHierarchyNodeSchema,
  reorderHierarchyLevelsSchema,
  renameHierarchyNodeSchema,
  retireHierarchyNodeSchema,
  updateHierarchyLevelSchema,
} from '../../../contracts/organization.contract';
import { OrganizationAdministrationService } from '../services/organization-administration.service';

@Roles('SystemAdmin')
@Controller({ path: 'admin/organization', version: '1' })
export class OrganizationAdministrationController {
  constructor(private readonly organizations: OrganizationAdministrationService) {}

  /** Returns settings, full current hierarchy, and readiness quality counts. */
  @Get()
  workspace(@CurrentUser() principal: Principal) {
    return this.organizations.workspace(principal.organizationId);
  }

  /** Returns hierarchy data-quality status for administration and gates. */
  @Get('quality')
  quality(@CurrentUser() principal: Principal) {
    return this.organizations.quality(principal.organizationId);
  }

  /** Adds an optional hierarchy level (up to five). */
  @Post('levels')
  createLevel(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const parsed = createHierarchyLevelSchema.safeParse(body);
    if (!parsed.success) throw this.invalid('Invalid hierarchy level', parsed.error.issues.map((issue) => issue.message));
    return this.organizations.createLevel(principal.organizationId, parsed.data, principal.personId ?? principal.entraObjectId ?? 'system-admin');
  }

  /** Updates bilingual level labels. */
  @Patch('levels/:id')
  updateLevel(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    const parsed = updateHierarchyLevelSchema.safeParse(body);
    if (!parsed.success) throw this.invalid('Invalid hierarchy level update', parsed.error.issues.map((issue) => issue.message));
    return this.organizations.updateLevel(id, principal.organizationId, parsed.data, principal.personId ?? principal.entraObjectId ?? 'system-admin');
  }

  /** Reorders level definitions after validating populated parent-child edges. */
  @Post('levels/reorder')
  reorderLevels(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const parsed = reorderHierarchyLevelsSchema.safeParse(body);
    if (!parsed.success) throw this.invalid('Invalid hierarchy level order', parsed.error.issues.map((issue) => issue.message));
    return this.organizations.reorderLevels(principal.organizationId, parsed.data, principal.personId ?? principal.entraObjectId ?? 'system-admin');
  }

  /** Returns recently retired hierarchy nodes for history/reactivation. */
  @Get('retired')
  retired(@CurrentUser() principal: Principal) {
    return this.organizations.retired(principal.organizationId);
  }

  /** Returns active dependencies before a high-impact node operation. */
  @Get('nodes/:id/impact')
  impact(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('targetParentId') targetParentId: string | undefined,
    @CurrentUser() principal: Principal,
  ) {
    return this.organizations.impact(id, principal.organizationId, targetParentId);
  }

  /** Returns append-only hierarchy history for one node. */
  @Get('nodes/:id/history')
  history(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() principal: Principal) {
    return this.organizations.history(id, principal.organizationId);
  }

  /** Returns selected-node operational detail for the organization workspace. */
  @Get('nodes/:id/detail')
  detail(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() principal: Principal) {
    return this.organizations.nodeDetail(id, principal.organizationId);
  }

  /** Creates a child hierarchy node under an existing parent. */
  @Post('nodes')
  create(
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = createHierarchyNodeSchema.safeParse(body);
    if (!parsed.success) throw this.invalid('Invalid hierarchy node', parsed.error.issues.map((issue) => issue.message));
    return this.organizations.createNode(
      principal.organizationId,
      parsed.data,
      principal.personId ?? principal.entraObjectId ?? 'system-admin',
    );
  }

  /** Renames a node while preserving its stable code and path. */
  @Patch('nodes/:id')
  rename(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = renameHierarchyNodeSchema.safeParse(body);
    if (!parsed.success) throw this.invalid('Invalid hierarchy rename', parsed.error.issues.map((issue) => issue.message));
    return this.organizations.renameNode(
      id,
      principal.organizationId,
      parsed.data,
      principal.personId ?? principal.entraObjectId ?? 'system-admin',
    );
  }

  /** Retires a dependency-free leaf node at its current revision. */
  @Post('nodes/:id/retire')
  retire(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = retireHierarchyNodeSchema.safeParse(body);
    if (!parsed.success) throw this.invalid('Invalid hierarchy retirement', parsed.error.issues.map((issue) => issue.message));
    return this.organizations.retireNode(
      id,
      principal.organizationId,
      parsed.data,
      principal.personId ?? principal.entraObjectId ?? 'system-admin',
    );
  }

  /** Reactivates a retired node after validating its current revision. */
  @Post('nodes/:id/reactivate')
  reactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = reactivateHierarchyNodeSchema.safeParse(body);
    if (!parsed.success) throw this.invalid('Invalid hierarchy reactivation', parsed.error.issues.map((issue) => issue.message));
    return this.organizations.reactivateNode(
      id,
      principal.organizationId,
      parsed.data,
      principal.personId ?? principal.entraObjectId ?? 'system-admin',
    );
  }

  /** Moves a subtree using an expected revision and fresh impact token. */
  @Post('nodes/:id/move')
  move(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const parsed = moveHierarchyNodeSchema.safeParse(body);
    if (!parsed.success) throw this.invalid('Invalid hierarchy move', parsed.error.issues.map((issue) => issue.message));
    return this.organizations.moveNode(
      id,
      principal.organizationId,
      parsed.data,
      principal.personId ?? principal.entraObjectId ?? 'system-admin',
    );
  }

  /** Builds the common RFC-7807 validation response. */
  private invalid(title: string, reasons: string[]): BadRequestException {
    return new BadRequestException({ title, reasons });
  }
}
