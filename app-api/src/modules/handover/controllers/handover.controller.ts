import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  addDamageSchema,
  createHandoverAmendmentSchema,
  handoverRegisterQuerySchema,
  openHandoverSchema,
  openHandoverV2Schema,
  recordReturnSchema,
  recordReturnV2Schema,
  stageHandoverEvidenceQuerySchema,
} from '../../../contracts/handover.contract';
import { HandoverService } from '../services/handover.service';

/** Roles that operate handovers (the fleet manager at the pool and above). */
const FLEET_ROLES = ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'] as const;

/** Requires the authenticated Principal before Handover service authorization. */
const requiredPrincipal = (principal?: Principal): Principal => {
  if (!principal) throw new ForbiddenException({ title: 'Authenticated principal is required', reasons: ['authenticated-principal-required'] });
  return principal;
};

/** Requires a bounded Handover command replay key. */
const requiredIdempotencyKey = (value?: string): string => {
  const key = value?.trim();
  if (!key || key.length < 8 || key.length > 200) throw new BadRequestException({ title: 'A valid Idempotency-Key header is required', reasons: ['handover-idempotency-key-required'] });
  return key;
};

/** Parses a body with a Zod schema or throws an RFC-7807 400. */
function parse<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException({
      title: 'Invalid request',
      reasons: result.error.issues.map((i) => i.message),
    });
  }
  return result.data;
}

@Controller({ version: '1' })
export class HandoverController {
  constructor(private readonly handovers: HandoverService) {}

  /** GET /api/v1/handovers — scoped release and active-custody register. */
  @Roles(...FLEET_ROLES)
  @Get('handovers')
  worklist(@CurrentUser() principal?: Principal) {
    return this.handovers.worklist(requiredPrincipal(principal));
  }

  /** GET /api/v1/handovers/register — historical screen-26 custody register. */
  @Roles(...FLEET_ROLES)
  @Get('handovers/register')
  register(@Query() query: unknown, @CurrentUser() principal?: Principal) {
    return this.handovers.register(
      parse(handoverRegisterQuerySchema, query),
      requiredPrincipal(principal),
    );
  }

  /** GET /api/v1/handovers/work-items — explicit Approved/Active compatibility worklist. */
  @Roles(...FLEET_ROLES)
  @Get('handovers/work-items')
  workItems(@CurrentUser() principal?: Principal) {
    return this.handovers.workItems(requiredPrincipal(principal));
  }

  /** GET /api/v1/handovers/capture-context — persisted mockup header and evidence facts. */
  @Roles(...FLEET_ROLES)
  @Get('handovers/capture-context')
  captureContext(@Query('bookingId') bookingId: string, @CurrentUser() principal?: Principal) {
    const parsed = z.string().uuid().safeParse(bookingId);
    if (!parsed.success) throw new BadRequestException({ title: 'Invalid Booking id', reasons: ['handover-booking-id-invalid'] });
    return this.handovers.captureContext(parsed.data, requiredPrincipal(principal));
  }

  /** POST /api/v1/handover-evidence/uploads — stages one bounded private image. */
  @Roles(...FLEET_ROLES)
  @Post('handover-evidence/uploads')
  stageEvidence(
    @Query() query: unknown,
    @Req() request: FastifyRequest,
    @CurrentUser() principal?: Principal,
  ) {
    const body = request.body;
    if (!Buffer.isBuffer(body)) throw new BadRequestException({ title: 'Raw image body is required', reasons: ['handover-evidence-body-required'] });
    const mimeType = String(request.headers['content-type'] ?? '').split(';', 1)[0] ?? '';
    return this.handovers.stageEvidence(
      parse(stageHandoverEvidenceQuerySchema, query),
      body,
      mimeType,
      requiredPrincipal(principal),
    );
  }

  /** POST /api/v1/handovers — open a handover for an approved booking (→ Active). */
  @Roles(...FLEET_ROLES)
  @Post('handovers')
  open(@Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    const schema = (body as { schemaVersion?: unknown } | null)?.schemaVersion === 2 ? openHandoverV2Schema : openHandoverSchema;
    return this.handovers.open(parse(schema, body), requiredPrincipal(principal), requiredIdempotencyKey(idempotencyKey));
  }

  /** GET /api/v1/handovers/:id — a handover projection with damage pins. */
  @Roles(...FLEET_ROLES)
  @Get('handovers/:id')
  get(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.handovers.get(id, requiredPrincipal(principal));
  }

  /** GET /api/v1/handovers/:id/chain — immutable issue-to-return evidence chain. */
  @Roles(...FLEET_ROLES)
  @Get('handovers/:id/chain')
  chain(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) throw new BadRequestException({ title: 'Invalid Handover id', reasons: ['handover-id-invalid'] });
    return this.handovers.chain(parsed.data, requiredPrincipal(principal));
  }

  /** GET /api/v1/handovers/:id/receipt — locked completion projection. */
  @Roles(...FLEET_ROLES)
  @Get('handovers/:id/receipt')
  receipt(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) throw new BadRequestException({ title: 'Invalid Handover id', reasons: ['handover-id-invalid'] });
    return this.handovers.receipt(parsed.data, requiredPrincipal(principal));
  }

  /** POST /api/v1/handovers/:id/amendments — appends a versioned correction. */
  @Roles(...FLEET_ROLES)
  @Post('handovers/:id/amendments')
  amend(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal?: Principal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) throw new BadRequestException({ title: 'Invalid Handover id', reasons: ['handover-id-invalid'] });
    return this.handovers.amend(
      parsed.data,
      parse(createHandoverAmendmentSchema, body),
      requiredPrincipal(principal),
      requiredIdempotencyKey(idempotencyKey),
    );
  }

  /** POST /api/v1/handovers/:id/return — record the return (reconciliation → Completed). */
  @Roles(...FLEET_ROLES)
  @Post('handovers/:id/return')
  return(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    const schema = (body as { schemaVersion?: unknown } | null)?.schemaVersion === 2 ? recordReturnV2Schema : recordReturnSchema;
    return this.handovers.recordReturn(id, parse(schema, body), requiredPrincipal(principal), requiredIdempotencyKey(idempotencyKey));
  }

  /** POST /api/v1/handovers/:id/damage — add a damage pin. */
  @Roles(...FLEET_ROLES)
  @Post('handovers/:id/damage')
  damage(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.handovers.addDamage(id, parse(addDamageSchema, body), requiredPrincipal(principal));
  }

  /** GET /api/v1/vehicles/:id/keys — key custody log for a vehicle. */
  @Roles(...FLEET_ROLES)
  @Get('vehicles/:id/keys')
  keys(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.handovers.keys(id, requiredPrincipal(principal));
  }
}
