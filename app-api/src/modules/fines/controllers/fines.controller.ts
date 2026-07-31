import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  recordAccidentSchema,
  recordFineSchema,
  recordRecoverySchema,
  substitutionWindowSchema,
} from '../../../contracts/fine.contract';
import { FinesService } from '../services/fines.service';

const actorRef = (p?: Principal): string => p?.personId ?? p?.entraObjectId ?? 'system';

/** Requires the authenticated Principal attached by the global auth guard. */
function requiredPrincipal(principal?: Principal): Principal {
  if (!principal) throw new BadRequestException({ title: 'Authenticated Principal is required', reasons: ['principal-required'] });
  return principal;
}

/** Roles that record/manage fines, accidents, substitution windows and blocks. */
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

@Controller({ version: '1' })
export class FinesController {
  constructor(private readonly fines: FinesService) {}

  /** POST /api/v1/fines — record + auto-attribute a fine. */
  @Roles(...FLEET_ROLES)
  @Post('fines')
  record(@Body() body: unknown, @CurrentUser() principal?: Principal) {
    const authenticated = requiredPrincipal(principal);
    return this.fines.recordFine(parse(recordFineSchema, body), authenticated.organizationId, actorRef(authenticated));
  }

  /** GET /api/v1/fines — list fines. */
  @Get('fines')
  list(@Query('limit') limit = '50', @Query('offset') offset = '0', @CurrentUser() principal?: Principal) {
    return this.fines.listFines(requiredPrincipal(principal).organizationId, Math.min(Math.max(Number(limit) || 50, 1), 200), Math.max(Number(offset) || 0, 0));
  }

  /** POST /api/v1/accidents — record + auto-attribute an accident. */
  @Roles(...FLEET_ROLES)
  @Post('accidents')
  accident(@Body() body: unknown, @CurrentUser() principal?: Principal) {
    const authenticated = requiredPrincipal(principal);
    return this.fines.recordAccident(parse(recordAccidentSchema, body), authenticated.organizationId, actorRef(authenticated));
  }

  /** POST /api/v1/fines/:id/recovery — record a recovery instruction. */
  @Roles(...FLEET_ROLES, 'Finance')
  @Post('fines/:id/recovery')
  recovery(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    const authenticated = requiredPrincipal(principal);
    return this.fines.recordRecovery(id, parse(recordRecoverySchema, body), actorRef(authenticated), authenticated.organizationId);
  }

  /** POST /api/v1/vehicles/:id/substitution-windows — record a substitution window (P1B-R2-4). */
  @Roles(...FLEET_ROLES)
  @Post('vehicles/:id/substitution-windows')
  substitution(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal?: Principal) {
    const authenticated = requiredPrincipal(principal);
    return this.fines.addSubstitutionWindow(id, parse(substitutionWindowSchema, body), authenticated.organizationId, actorRef(authenticated));
  }

  /** POST /api/v1/black-points/enforce-overdue — block drivers with overdue transfers. */
  @Roles('SystemAdmin', 'HSE')
  @Post('black-points/enforce-overdue')
  enforceOverdue(@CurrentUser() principal?: Principal) {
    const authenticated = requiredPrincipal(principal);
    return this.fines.enforceOverdueBlackPoints(authenticated.organizationId, new Date(), actorRef(authenticated)).then((blocked) => ({ blocked }));
  }
}
