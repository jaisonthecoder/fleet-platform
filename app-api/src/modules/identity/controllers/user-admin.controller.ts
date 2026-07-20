import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import { assignRoleSchema, listUsersQuerySchema } from '../../../contracts/user-admin.contract';
import { AccessReviewService } from '../services/access-review.service';
import { UserAdminService } from '../services/user-admin.service';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';
import { AccessService } from '../../platform/services/access.service';

/**
 * User / access administration (RBAC-gated to System Admin). Assign/revoke
 * hierarchy-scoped roles (SoD-checked at assignment), manage account status,
 * and export the access-review recertification report. Every action is audited.
 */
@Roles('SystemAdmin')
@Controller({ path: 'admin', version: '1' })
export class UserAdminController {
  constructor(
    private readonly userAdmin: UserAdminService,
    private readonly accessReview: AccessReviewService,
    private readonly scopeAuthorization: ScopeAuthorizationService,
    private readonly access: AccessService,
  ) {}

  /** Lists the workforce directory (paged + enriched), filtered by search/status/role. */
  @Get('users')
  listUsers(@Query() query: unknown) {
    const parsed = listUsersQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid users query',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.userAdmin.listUsers(parsed.data);
  }

  /** User-population summary tiles (bucketed by role family). */
  @Get('users/summary')
  summary() {
    return this.userAdmin.summary();
  }

  /** The active roles a person holds (per-person access view). */
  @Get('users/:personId/roles')
  userRoles(@Param('personId') personId: string) {
    return this.userAdmin.listPersonRoles(personId);
  }

  /** Assigns a role at a scope (SoD-checked); the acting admin is recorded. */
  @Post('roles')
  async assignRole(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const parsed = assignRoleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid role assignment',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    await this.scopeAuthorization.assertRolesAtScope(
      principal,
      ['SystemAdmin'],
      parsed.data.scopeNodeId,
    );
    const target = await this.access.contextFor(parsed.data.personId);
    if (target.organizationId !== principal.organizationId) {
      throw new BadRequestException({
        title: 'Role target belongs to another organization',
        reasons: ['role-target-organization-mismatch'],
      });
    }
    return this.userAdmin.assignRole({
      ...parsed.data,
      organizationId: principal.organizationId,
      assignedByPersonId: principal?.personId ?? parsed.data.assignedByPersonId,
    });
  }

  /** Revokes (effective-date-expires) a role assignment. */
  @Delete('roles/:assignmentId')
  revokeRole(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() principal: Principal,
  ) {
    return this.userAdmin.revokeRole(assignmentId, principal?.personId ?? 'admin');
  }

  /** Suspends a user's SSO login account (400 if the person has never signed in). */
  @Post('users/:userId/suspend')
  suspend(@Param('userId') userId: string, @CurrentUser() principal: Principal) {
    return this.userAdmin.setStatus({ userId }, 'Suspended', principal?.personId ?? 'admin');
  }

  /** Reactivates a user's SSO login account (400 if the person has never signed in). */
  @Post('users/:userId/reactivate')
  reactivate(@Param('userId') userId: string, @CurrentUser() principal: Principal) {
    return this.userAdmin.setStatus({ userId }, 'Active', principal?.personId ?? 'admin');
  }

  /** Access-review export ("who has what, where"). */
  @Get('access-review')
  accessReview_() {
    return this.accessReview.export();
  }
}
