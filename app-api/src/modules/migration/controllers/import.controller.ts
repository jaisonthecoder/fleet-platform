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
import { createImportSchema, resolveRowSchema } from '../../../contracts/import.contract';
import { ImportService } from '../services/import.service';

const actorRef = (principal?: Principal): string =>
  principal?.personId ?? principal?.entraObjectId ?? 'system';

const STEWARD_ROLES = ['DataSteward', 'FleetManager', 'ClusterFleetLead', 'SystemAdmin'] as const;

/**
 * Bulk migration import API (M3). Stewards stage, review, resolve and sign off
 * an import; sign-off commits valid rows to the vehicle master. Reads are
 * available to any authenticated user; mutations are steward-gated.
 */
@Controller({ path: 'imports', version: '1' })
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Roles(...STEWARD_ROLES)
  @Post()
  create(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const parsed = createImportSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid import',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.imports.createBatch(parsed.data, actorRef(principal));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.imports.getBatch(id);
  }

  @Get(':id/rows')
  rows(@Param('id') id: string) {
    return this.imports.listRows(id);
  }

  @Roles(...STEWARD_ROLES)
  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    const parsed = resolveRowSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid resolution',
        reasons: parsed.error.issues.map((i) => i.message),
      });
    }
    return this.imports.resolve(id, parsed.data, actorRef(principal));
  }

  @Roles(...STEWARD_ROLES)
  @Post(':id/sign-off')
  signOff(@Param('id') id: string, @CurrentUser() principal: Principal) {
    return this.imports.signOff(id, actorRef(principal));
  }
}
