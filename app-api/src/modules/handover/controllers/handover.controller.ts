import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  addDamageSchema,
  openHandoverSchema,
  recordReturnSchema,
} from '../../../contracts/handover.contract';
import { HandoverService } from '../services/handover.service';

/** Actor reference for audit/history from the authenticated principal. */
const actorRef = (p?: Principal): string => p?.personId ?? p?.entraObjectId ?? 'system';

/** Roles that operate handovers (the fleet manager at the pool and above). */
const FLEET_ROLES = ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'SystemAdmin'] as const;

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

  /** POST /api/v1/handovers — open a handover for an approved booking (→ Active). */
  @Roles(...FLEET_ROLES)
  @Post('handovers')
  open(@Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.handovers.open(parse(openHandoverSchema, body), actorRef(principal));
  }

  /** GET /api/v1/handovers/:id — a handover projection with damage pins. */
  @Get('handovers/:id')
  get(@Param('id') id: string) {
    return this.handovers.get(id);
  }

  /** POST /api/v1/handovers/:id/return — record the return (reconciliation → Completed). */
  @Roles(...FLEET_ROLES)
  @Post('handovers/:id/return')
  return(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.handovers.recordReturn(id, parse(recordReturnSchema, body), actorRef(principal));
  }

  /** POST /api/v1/handovers/:id/damage — add a damage pin. */
  @Roles(...FLEET_ROLES)
  @Post('handovers/:id/damage')
  damage(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    return this.handovers.addDamage(id, parse(addDamageSchema, body), actorRef(principal));
  }

  /** GET /api/v1/vehicles/:id/keys — key custody log for a vehicle. */
  @Get('vehicles/:id/keys')
  keys(@Param('id') id: string) {
    return this.handovers.keys(id);
  }
}
