import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  addVehicleDocumentSchema,
  createVehicleSchema,
  updateVehicleSchema,
  vehicleTransferSchema,
  vehicleTransitionSchema,
} from '../../../contracts/vehicle.contract';
import { DocumentVaultService } from '../services/document-vault.service';
import { TransferService } from '../services/transfer.service';
import { VehicleService } from '../services/vehicle.service';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';

const actorRef = (principal?: Principal): string =>
  principal?.personId ?? principal?.entraObjectId ?? 'system';

/** Roles permitted to mutate the vehicle master. */
const FLEET_WRITE_ROLES = [
  'FleetManager',
  'ClusterFleetLead',
  'GroupFleetLead',
  'DataSteward',
  'SystemAdmin',
] as const;

/**
 * Vehicle master API (M2). Reads are available to any authenticated user;
 * writes are RBAC-gated to fleet-management roles. Every mutation emits a
 * `VehicleChanged` event (FR-INV-11).
 */
@Controller({ path: 'vehicles', version: '1' })
export class VehicleController {
  constructor(
    private readonly vehicles: VehicleService,
    private readonly documents: DocumentVaultService,
    private readonly transfers: TransferService,
    private readonly scopeAuthorization: ScopeAuthorizationService,
  ) {}

  @Get()
  list(@CurrentUser() principal: Principal, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.vehicles.list(Number(limit) || 50, Number(offset) || 0, principal.organizationId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.vehicles.get(id);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.vehicles.history(id);
  }

  @Roles(...FLEET_WRITE_ROLES)
  @Post()
  async create(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const input = this.parse(createVehicleSchema, body);
    if (input.homeNodeId) {
      await this.scopeAuthorization.assertRolesAtScope(principal, FLEET_WRITE_ROLES, input.homeNodeId);
    } else {
      await this.scopeAuthorization.assertRootRole(principal, FLEET_WRITE_ROLES);
    }
    return this.vehicles.create(input, actorRef(principal), principal.organizationId);
  }

  @Roles(...FLEET_WRITE_ROLES)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    await this.assertVehicleScope(id, principal);
    return this.vehicles.update(id, this.parse(updateVehicleSchema, body), actorRef(principal));
  }

  @Roles(...FLEET_WRITE_ROLES)
  @Post(':id/transition')
  async transition(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    await this.assertVehicleScope(id, principal);
    return this.vehicles.transition(id, this.parse(vehicleTransitionSchema, body), actorRef(principal));
  }

  @Roles(...FLEET_WRITE_ROLES)
  @Post(':id/documents')
  async addDocument(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    await this.assertVehicleScope(id, principal);
    return this.documents.addDocument(id, this.parse(addVehicleDocumentSchema, body), actorRef(principal));
  }

  @Roles(...FLEET_WRITE_ROLES)
  @Post(':id/transfer')
  async transfer(@Param('id') id: string, @Body() body: unknown, @CurrentUser() principal: Principal) {
    await this.assertVehicleScope(id, principal);
    const input = this.parse(vehicleTransferSchema, body);
    await this.scopeAuthorization.assertRolesAtScope(principal, FLEET_WRITE_ROLES, input.toNodeId);
    return this.transfers.transfer(id, input, actorRef(principal));
  }

  /** Requires a fleet-write role over the vehicle's current scope or organization root. */
  private async assertVehicleScope(id: string, principal: Principal): Promise<void> {
    if ((await this.vehicles.organizationOf(id)) !== principal.organizationId) {
      throw new BadRequestException({ title: 'Vehicle belongs to another organization', reasons: ['vehicle-organization-mismatch'] });
    }
    const scopeNodeId = await this.vehicles.activeScope(id);
    if (scopeNodeId) {
      await this.scopeAuthorization.assertRolesAtScope(principal, FLEET_WRITE_ROLES, scopeNodeId);
    } else {
      await this.scopeAuthorization.assertRootRole(principal, FLEET_WRITE_ROLES);
    }
  }

  private parse<T>(schema: { safeParse: (b: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid vehicle payload',
        reasons: parsed.error!.issues.map((i) => i.message),
      });
    }
    return parsed.data!;
  }
}
