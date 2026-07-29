import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  addDamageSchema,
  openHandoverSchema,
  recordReturnSchema,
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

  /** POST /api/v1/handovers — open a handover for an approved booking (→ Active). */
  @Roles(...FLEET_ROLES)
  @Post('handovers')
  open(@Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.handovers.open(parse(openHandoverSchema, body), requiredPrincipal(principal), requiredIdempotencyKey(idempotencyKey));
  }

  /** GET /api/v1/handovers/:id — a handover projection with damage pins. */
  @Roles(...FLEET_ROLES)
  @Get('handovers/:id')
  get(@Param('id') id: string, @CurrentUser() principal?: Principal) {
    return this.handovers.get(id, requiredPrincipal(principal));
  }

  /** POST /api/v1/handovers/:id/return — record the return (reconciliation → Completed). */
  @Roles(...FLEET_ROLES)
  @Post('handovers/:id/return')
  return(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.handovers.recordReturn(id, parse(recordReturnSchema, body), requiredPrincipal(principal), requiredIdempotencyKey(idempotencyKey));
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
