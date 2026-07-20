import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import { createDelegationSchema } from '../../../contracts/platform.contract';
import { AccessService } from '../services/access.service';
import { DelegationService } from '../services/delegation.service';
import { HierarchyService } from '../services/hierarchy.service';

/** Returns the linked person creating a delegation or rejects an unlinked identity. */
const delegationActor = (principal: Principal): string => {
  if (!principal.personId) {
    throw new ForbiddenException({
      title: 'User not linked',
      reasons: ['user-not-linked-to-person'],
    });
  }
  return principal.personId;
};

@Controller({ version: '1' })
export class IdentityController {
  constructor(
    private readonly access: AccessService,
    private readonly hierarchy: HierarchyService,
    private readonly delegation: DelegationService,
  ) {}

  /**
   * Identity + roles/scopes for the authenticated caller. The principal is set
   * by the global auth guard (verified Entra JWT, or dev-login in lower
   * environments). A provisioned account not yet linked to an HR person holds
   * no roles and is asked to be linked by an admin.
   */
  @Get('me')
  me(@CurrentUser() principal: Principal) {
    if (!principal?.personId) {
      throw new ForbiddenException({
        title: 'User not linked',
        reasons: ['user-not-linked-to-person'],
      });
    }
    return this.access.getMe(principal.personId);
  }

  /** The configurable hierarchy tree (Scope Switcher + roll-up source). */
  @Get('hierarchy')
  getHierarchy(@CurrentUser() principal: Principal) {
    return this.hierarchy.getAuthorizedTree(principal);
  }

  /** Creates a time-boxed delegation of approval authority. */
  @Post('delegations')
  createDelegation(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const parsed = createDelegationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid delegation',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.delegation.create(parsed.data, delegationActor(principal));
  }
}
