import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  allocateEntitlementSchema,
  bsdWindowSchema,
  cancelBsdWindowSchema,
  confirmBsdWindowSchema,
  createSelfEntitlementSchema,
  ENTITLEMENT_REASON,
  entitlementActionSchema,
  entitlementConsentSchema,
  entitlementEligibilityPreviewSchema,
  entitlementLifecycleCommandSchema,
  renewEntitlementSchema,
  submitEntitlementSchema,
  updateEntitlementDraftSchema,
} from '../../../contracts/entitlement.contract';
import { EntitlementService } from '../services/entitlement.service';

const actorRef = (p?: Principal): string => p?.personId ?? p?.entraObjectId ?? 'system';

const requiredPrincipal = (principal?: Principal): Principal => {
  if (!principal) {
    throw new ForbiddenException({
      title: 'Authenticated principal is required',
      reasons: [ENTITLEMENT_REASON.principalRequired],
    });
  }
  return principal;
};

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
const FLEET_ROLES = ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'] as const;

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
  create(
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const actor = requiredPrincipal(principal);
    const input = parse(createSelfEntitlementSchema, body);
    return this.entitlements.create(
      { ...input, requesterPersonId: approvalActor(actor) },
      actorRef(actor),
      actor,
      idempotencyKey,
    );
  }

  /** GET /api/v1/entitlements/context — actor defaults and unresolved gates. */
  @Get('context')
  context(@CurrentUser() principal?: Principal) {
    return this.entitlements.context(requiredPrincipal(principal));
  }

  /** GET /api/v1/entitlements/justification-categories — manual bilingual D3 values. */
  @Get('justification-categories')
  justificationCategories(@CurrentUser() principal?: Principal) {
    requiredPrincipal(principal);
    return this.entitlements.justificationCategories();
  }

  /** GET /api/v1/entitlements/vehicle-classes — manual bilingual Vehicle classes. */
  @Get('vehicle-classes')
  vehicleClasses(@CurrentUser() principal?: Principal) {
    requiredPrincipal(principal);
    return this.entitlements.vehicleClasses();
  }

  /** GET /api/v1/entitlements/professional-drivers — scoped editable driver roster. */
  @Get('professional-drivers')
  professionalDrivers(
    @Query('locationNodeId') locationNodeId: string,
    @CurrentUser() principal?: Principal,
  ) {
    return this.entitlements.professionalDrivers(locationNodeId, requiredPrincipal(principal));
  }

  /** POST /api/v1/entitlements/eligibility-preview — side-effect-free configured D8 evaluation. */
  @Post('eligibility-preview')
  eligibilityPreview(
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
  ) {
    return this.entitlements.eligibilityPreview(
      parse(entitlementEligibilityPreviewSchema, body),
      requiredPrincipal(principal),
    );
  }

  /** GET /api/v1/entitlements/approvals — assigned/delegated Dedicated approval tasks. */
  @Roles(...APPROVER_ROLES)
  @Get('approvals')
  approvals(@CurrentUser() principal?: Principal) {
    return this.entitlements.approvalWorklist(requiredPrincipal(principal));
  }

  /** GET /api/v1/entitlements/consent-context — current governed consent content. */
  @Get('consent-context')
  consentContext(@CurrentUser() principal?: Principal) {
    const actor = requiredPrincipal(principal);
    return this.entitlements.consentContext(actor);
  }

  /** GET /api/v1/entitlements/allocation-worklist — scoped consented requests and options. */
  @Roles(...FLEET_ROLES)
  @Get('allocation-worklist')
  allocationWorklist(@CurrentUser() principal?: Principal) {
    return this.entitlements.allocationWorklist(requiredPrincipal(principal));
  }

  /** GET /api/v1/entitlements/reconciliation — read-only, tenant-safe operational findings. */
  @Roles('SystemAdmin', 'InternalAudit')
  @Get('reconciliation')
  reconciliation(@CurrentUser() principal?: Principal, @Query('limit') limit = '200') {
    return this.entitlements.reconciliation(requiredPrincipal(principal), Number(limit) || 200);
  }

  /** GET /api/v1/entitlements — list entitlement requests. */
  @Get()
  list(
    @CurrentUser() principal?: Principal,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.entitlements.listOwn(
      requiredPrincipal(principal),
      Math.min(Math.max(Number(limit) || 50, 1), 200),
      Math.max(Number(offset) || 0, 0),
    );
  }

  /** GET /api/v1/entitlements/:id — an entitlement projection. */
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.entitlements.get(id, requiredPrincipal(principal));
  }

  /** GET /api/v1/entitlements/:id/events — owner-safe immutable chronology. */
  @Get(':id/events')
  events(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.entitlements.events(id, requiredPrincipal(principal));
  }

  /** GET /api/v1/entitlements/:id/bsd-windows — persisted privacy-safe schedule. */
  @Get(':id/bsd-windows')
  bsdWindows(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.entitlements.bsdWindows(id, requiredPrincipal(principal));
  }

  /** PATCH /api/v1/entitlements/:id — owner edit of a Draft with revision protection. */
  @Patch(':id')
  updateDraft(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.entitlements.updateDraft(
      id,
      parse(updateEntitlementDraftSchema, body),
      requiredPrincipal(principal),
      idempotencyKey,
    );
  }

  /** POST /api/v1/entitlements/:id/submit — eligibility pre-check + route to the chain. */
  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.entitlements.submit(id, parse(submitEntitlementSchema, body), requiredPrincipal(principal), idempotencyKey);
  }

  /** POST /api/v1/entitlements/:id/approve — approver approves the current step. */
  @Roles(...APPROVER_ROLES)
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    const actorPersonId = approvalActor(principal);
    const action = parse(entitlementActionSchema, body);
    return this.entitlements.decide(
      id,
      { ...action, actorPersonId },
      'APPROVED',
      principal,
      idempotencyKey,
    );
  }

  /** POST /api/v1/entitlements/:id/decline — approver declines. */
  @Roles(...APPROVER_ROLES)
  @Post(':id/decline')
  decline(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    const actorPersonId = approvalActor(principal);
    const action = parse(entitlementActionSchema, body);
    return this.entitlements.decide(
      id,
      { ...action, actorPersonId },
      'REJECTED',
      principal,
      idempotencyKey,
    );
  }

  /** POST /api/v1/entitlements/:id/request-modification — return actionable comments to the owner. */
  @Roles(...APPROVER_ROLES)
  @Post(':id/request-modification')
  requestModification(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    const actorPersonId = approvalActor(principal);
    const action = parse(entitlementActionSchema, body);
    return this.entitlements.decide(id, { ...action, actorPersonId }, 'MODIFICATION_REQUESTED', principal, idempotencyKey);
  }

  /** POST /api/v1/entitlements/:id/consent — driver consent before allocation. */
  @Post(':id/consent')
  consent(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.entitlements.consent(id, parse(entitlementConsentSchema, body), requiredPrincipal(principal), idempotencyKey);
  }

  /** POST /api/v1/entitlements/:id/allocate — allocate an approved + consented request to a vehicle. */
  @Roles(...FLEET_ROLES)
  @Post(':id/allocate')
  allocate(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.entitlements.allocate(id, parse(allocateEntitlementSchema, body), requiredPrincipal(principal), idempotencyKey);
  }

  /** POST /api/v1/entitlements/:id/bsd-windows — record a BSD (leave) return window. */
  @Roles(...FLEET_ROLES)
  @Post(':id/bsd-windows')
  bsdWindow(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.entitlements.addBsdWindow(id, parse(bsdWindowSchema, body), requiredPrincipal(principal));
  }

  /** POST /api/v1/entitlements/bsd-windows/:windowId/confirm — Fleet confirmation. */
  @Roles(...FLEET_ROLES)
  @Post('bsd-windows/:windowId/confirm')
  confirmBsdWindow(@Param('windowId') windowId: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    const input = parse(confirmBsdWindowSchema, body);
    return this.entitlements.confirmBsdWindow(windowId, input.reason, requiredPrincipal(principal));
  }

  /** POST /api/v1/entitlements/bsd-windows/:windowId/cancel — cancel a future window. */
  @Roles(...FLEET_ROLES)
  @Post('bsd-windows/:windowId/cancel')
  cancelBsdWindow(@Param('windowId') windowId: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    const input = parse(cancelBsdWindowSchema, body);
    return this.entitlements.cancelBsdWindow(windowId, input.reason, requiredPrincipal(principal));
  }

  /** POST /api/v1/entitlements/:id/cancel — cancel a non-terminal entitlement. */
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.entitlements.cancel(id, parse(entitlementLifecycleCommandSchema, body), requiredPrincipal(principal), idempotencyKey);
  }

  /** POST /api/v1/entitlements/:id/renew — create a linked fresh Draft. */
  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.entitlements.renew(id, parse(renewEntitlementSchema, body), requiredPrincipal(principal), idempotencyKey);
  }

  /** POST /api/v1/entitlements/:id/return — close allocation and restore a safe Vehicle. */
  @Roles(...FLEET_ROLES)
  @Post(':id/return')
  returnVehicle(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.entitlements.returnVehicle(id, parse(entitlementLifecycleCommandSchema, body), requiredPrincipal(principal), idempotencyKey);
  }

  /** POST /api/v1/entitlements/:id/expire — system/Fleet expiry through governed return. */
  @Roles(...FLEET_ROLES)
  @Post(':id/expire')
  expire(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.entitlements.expire(id, parse(entitlementLifecycleCommandSchema, body), requiredPrincipal(principal), idempotencyKey);
  }
}
