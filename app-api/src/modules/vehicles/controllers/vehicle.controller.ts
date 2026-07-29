import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
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
 * Vehicle master API (M2). Reads and writes require a fleet-management role
 * over the vehicle's hierarchy scope. Every mutation emits a `VehicleChanged`
 * event (FR-INV-11).
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
  @Roles(...FLEET_WRITE_ROLES)
  async list(
    @CurrentUser() principal: Principal,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    const [authorizedNodeIds, includeUnassigned] = await Promise.all([
      this.scopeAuthorization.authorizedDescendantIds(
        principal,
        FLEET_WRITE_ROLES,
      ),
      this.scopeAuthorization.hasRootRole(principal, FLEET_WRITE_ROLES),
    ]);
    const size = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
    const current = Math.max(Number(page) || 1, 1);
    const [items, total] = await Promise.all([
      this.vehicles.list(
        size,
        (current - 1) * size,
        principal.organizationId,
        authorizedNodeIds,
        includeUnassigned,
        search,
        sort,
      ),
      this.vehicles.count(
        principal.organizationId,
        authorizedNodeIds,
        includeUnassigned,
        search,
      ),
    ]);
    return { items, total, page: current, pageSize: size };
  }

  @Get('export')
  @Roles(...FLEET_WRITE_ROLES)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="vehicles.csv"')
  async export(
    @CurrentUser() principal: Principal,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ): Promise<string> {
    const [authorizedNodeIds, includeUnassigned] = await Promise.all([
      this.scopeAuthorization.authorizedDescendantIds(
        principal,
        FLEET_WRITE_ROLES,
      ),
      this.scopeAuthorization.hasRootRole(principal, FLEET_WRITE_ROLES),
    ]);
    const rows = await this.vehicles.list(
      100_000,
      0,
      principal.organizationId,
      authorizedNodeIds,
      includeUnassigned,
      search,
      sort,
    );
    const headers = [
      'plate',
      'chassisVin',
      'make',
      'model',
      'lifecycle',
      'operational',
      'node',
      'mulkiyaExpiry',
      'insuranceExpiry',
      'odometer',
    ];
    const cell = (value: unknown): string => {
      const text = value == null ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = rows.map((v) =>
      [
        v.plate,
        v.chassisVin,
        v.makeCode,
        v.modelCode,
        v.lifecycleStatus,
        v.operationalStatus,
        v.hierarchyNodeName,
        v.mulkiyaExpiry,
        v.insuranceExpiry,
        v.lastConfirmedOdometer,
      ]
        .map(cell)
        .join(','),
    );
    return [headers.join(','), ...lines].join('\n');
  }

  @Get('summary')
  @Roles(...FLEET_WRITE_ROLES)
  async summary(@CurrentUser() principal: Principal) {
    const [authorizedNodeIds, includeUnassigned] = await Promise.all([
      this.scopeAuthorization.authorizedDescendantIds(
        principal,
        FLEET_WRITE_ROLES,
      ),
      this.scopeAuthorization.hasRootRole(principal, FLEET_WRITE_ROLES),
    ]);
    return this.vehicles.summary(
      principal.organizationId,
      authorizedNodeIds,
      includeUnassigned,
    );
  }

  @Get(':id')
  @Roles(...FLEET_WRITE_ROLES)
  async get(@Param('id') id: string, @CurrentUser() principal: Principal) {
    await this.assertVehicleScope(id, principal);
    return this.vehicles.get(id);
  }

  @Get(':id/history')
  @Roles(...FLEET_WRITE_ROLES)
  async history(@Param('id') id: string, @CurrentUser() principal: Principal) {
    await this.assertVehicleScope(id, principal);
    return this.vehicles.history(id);
  }

  @Get(':id/transfers')
  @Roles(...FLEET_WRITE_ROLES)
  async transferHistory(@Param('id') id: string, @CurrentUser() principal: Principal) {
    await this.assertVehicleScope(id, principal);
    return this.vehicles.transfers(id);
  }
  @Get(':id/documents')
  @Roles(...FLEET_WRITE_ROLES)
  async listDocuments(
    @Param('id') id: string,
    @CurrentUser() principal: Principal,
  ) {
    await this.assertVehicleScope(id, principal);
    return this.documents.listDocuments(id);
  }
  @Roles(...FLEET_WRITE_ROLES)
  @Post()
  async create(@Body() body: unknown, @CurrentUser() principal: Principal) {
    const input = this.parse(createVehicleSchema, body);
    if (input.homeNodeId) {
      await this.scopeAuthorization.assertRolesAtScope(
        principal,
        FLEET_WRITE_ROLES,
        input.homeNodeId,
      );
    } else {
      await this.scopeAuthorization.assertRootRole(
        principal,
        FLEET_WRITE_ROLES,
      );
    }
    return this.vehicles.create(
      input,
      actorRef(principal),
      principal.organizationId,
    );
  }

  @Roles(...FLEET_WRITE_ROLES)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    await this.assertVehicleScope(id, principal);
    return this.vehicles.update(
      id,
      this.parse(updateVehicleSchema, body),
      actorRef(principal),
    );
  }

  @Roles(...FLEET_WRITE_ROLES)
  @Post(':id/transition')
  async transition(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    await this.assertVehicleScope(id, principal);
    return this.vehicles.transition(
      id,
      this.parse(vehicleTransitionSchema, body),
      actorRef(principal),
    );
  }

  @Roles(...FLEET_WRITE_ROLES)
  @Post(':id/documents')
  async addDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    await this.assertVehicleScope(id, principal);
    return this.documents.addDocument(
      id,
      this.parse(addVehicleDocumentSchema, body),
      actorRef(principal),
    );
  }

  @Roles(...FLEET_WRITE_ROLES)
  @Post(':id/transfer')
  async transfer(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    await this.assertVehicleScope(id, principal);
    const input = this.parse(vehicleTransferSchema, body);
    await this.scopeAuthorization.assertRolesAtScope(
      principal,
      FLEET_WRITE_ROLES,
      input.toNodeId,
    );
    return this.transfers.transfer(id, input, actorRef(principal));
  }

  /** Requires a fleet-write role over the vehicle's current scope or organization root. */
  private async assertVehicleScope(
    id: string,
    principal: Principal,
  ): Promise<void> {
    await this.assertVehicleOrganization(id, principal);
    const scopeNodeId = await this.vehicles.activeScope(id);
    if (scopeNodeId) {
      await this.scopeAuthorization.assertRolesAtScope(
        principal,
        FLEET_WRITE_ROLES,
        scopeNodeId,
      );
    } else {
      await this.scopeAuthorization.assertRootRole(
        principal,
        FLEET_WRITE_ROLES,
      );
    }
  }

  /** Rejects vehicle access when the resource belongs to another organization. */
  private async assertVehicleOrganization(
    id: string,
    principal: Principal,
  ): Promise<void> {
    if ((await this.vehicles.organizationOf(id)) !== principal.organizationId) {
      throw new BadRequestException({
        title: 'Vehicle belongs to another organization',
        reasons: ['vehicle-organization-mismatch'],
      });
    }
  }

  private parse<T>(
    schema: {
      safeParse: (b: unknown) => {
        success: boolean;
        data?: T;
        error?: { issues: { message: string }[] };
      };
    },
    body: unknown,
  ): T {
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
