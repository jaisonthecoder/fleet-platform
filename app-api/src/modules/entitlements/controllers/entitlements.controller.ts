import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  allocateEntitlementSchema,
  bsdWindowSchema,
  createEntitlementSchema,
  entitlementActionSchema,
  entitlementConsentSchema,
} from '../../../contracts/entitlement.contract';
import { EntitlementService } from '../services/entitlement.service';

const actorRef = (p?: Principal): string => p?.personId ?? p?.entraObjectId ?? 'system';

/** Returns the linked person acting on an approval or rejects an unlinked identity. */
const approvalActor = (principal: Principal): string => {
  if (!principal.personId) {
    throw new ForbiddenException({
      title: 'User not linked',
      reasons: ['user-not-linked-to-person'],
    });
  }
  return principal.personId;
};

/** Roles that may act on an entitlement approval step (SoD-02 + assignee is the real gate). */
const APPROVER_ROLES = ['Approver', 'Delegate', 'FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'ClusterCEO'] as const;
/** Roles that allocate / manage dedicated vehicles. */
const FLEET_ROLES = ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'SystemAdmin'] as const;

function parse<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException({ title: 'Invalid request', reasons: result.error.issues.map((i) => i.message) });
  }
  return result.data;
}

@Controller({ path: 'entitlements', version: '1' })
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementService) {}

  /** POST /api/v1/entitlements — create a dedicated-vehicle entitlement request. */
  @Post()
  create(@Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.entitlements.create(parse(createEntitlementSchema, body), actorRef(principal));
  }

  /** GET /api/v1/entitlements — list entitlement requests. */
  @Get()
  list(@Query('limit') limit = '50', @Query('offset') offset = '0') {
    return this.entitlements.list(Math.min(Math.max(Number(limit) || 50, 1), 200), Math.max(Number(offset) || 0, 0));
  }

  /** GET /api/v1/entitlements/:id — an entitlement projection. */
  @Get(':id')
  get(@Param('id') id: string) {
    return this.entitlements.get(id);
  }

  /** POST /api/v1/entitlements/:id/submit — eligibility pre-check + route to the chain. */
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.entitlements.submit(id, actorRef(principal));
  }

  /** POST /api/v1/entitlements/:id/approve — approver approves the current step. */
  @Roles(...APPROVER_ROLES)
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    const action = parse(entitlementActionSchema, body);
    return this.entitlements.decide(
      id,
      { ...action, actorPersonId: approvalActor(principal) },
      'APPROVED',
    );
  }

  /** POST /api/v1/entitlements/:id/decline — approver declines. */
  @Roles(...APPROVER_ROLES)
  @Post(':id/decline')
  decline(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    const action = parse(entitlementActionSchema, body);
    return this.entitlements.decide(
      id,
      { ...action, actorPersonId: approvalActor(principal) },
      'REJECTED',
    );
  }

  /** POST /api/v1/entitlements/:id/consent — driver consent before allocation. */
  @Post(':id/consent')
  consent(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.entitlements.consent(id, parse(entitlementConsentSchema, body), actorRef(principal));
  }

  /** POST /api/v1/entitlements/:id/allocate — allocate an approved + consented request to a vehicle. */
  @Roles(...FLEET_ROLES)
  @Post(':id/allocate')
  allocate(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.entitlements.allocate(id, parse(allocateEntitlementSchema, body), actorRef(principal));
  }

  /** POST /api/v1/entitlements/:id/bsd-windows — record a BSD (leave) return window. */
  @Roles(...FLEET_ROLES)
  @Post(':id/bsd-windows')
  bsdWindow(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.entitlements.addBsdWindow(id, parse(bsdWindowSchema, body), actorRef(principal));
  }

  /** POST /api/v1/entitlements/:id/cancel — cancel a non-terminal entitlement. */
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.entitlements.cancel(id, actorRef(principal));
  }
}
