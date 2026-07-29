import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OutboxService } from '../../../common/messaging/outbox.service';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/database/schema';
import type {
  CreateVehicle,
  UpdateVehicle,
  VehicleDto,
  VehicleTransition,
} from '../../../contracts/vehicle.contract';
import { AuditService } from '../../platform/services/audit.service';
import { LookupService } from '../../config/services/lookup.service';
import { toDbException } from '../internal/pg-error';
import {
  assertTransition,
  type VehicleLifecycleStatus,
} from '../internal/vehicle-lifecycle';
import { VehicleRepository } from '../repositories/vehicle.repository';
import { VendorService } from '../../vendors/services/vendor.service';

type VehicleRow = NonNullable<
  Awaited<ReturnType<VehicleRepository['findById']>>
>;

/**
 * The vehicle master service (M2). Owns CRUD, lifecycle transitions, the
 * versioned document vault link, uniqueness enforcement, and lookup-validated
 * classification. Every state change writes domain state + append-only history
 * + audit + a `VehicleChanged` outbox event in **one transaction** (FR-INV-11).
 * Bus/Equipment are forced non-bookable by a DB trigger, not app logic.
 */
@Injectable()
export class VehicleService {
  constructor(
    private readonly repo: VehicleRepository,
    private readonly lookups: LookupService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly vendors: VendorService,
  ) {}

  /** Creates a vehicle after validating its classification codes against lookups. */
  async create(
    input: CreateVehicle,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VehicleDto> {
    if (
      input.ownership !== 'Leased' &&
      (input.vendorId || input.leaseContractId)
    ) {
      throw new BadRequestException({
        title: 'Owned vehicles cannot reference a vendor lease',
        reasons: ['vehicle-owned-vendor-lease-forbidden'],
      });
    }
    await this.validateClassification(input);
    this.assertPoolActivation(input);
    const lease =
      input.ownership === 'Leased'
        ? await this.vendors.requireUsableVehicleLease(
            input.vendorId!,
            input.leaseContractId!,
            organizationId,
          )
        : null;
    try {
      return await this.repo.transaction(async (tx) => {
        const created = await this.repo.insert(
          {
            organizationId,
            plate: input.plate,
            chassisVin: input.chassisVin,
            bodyTypeCode: input.bodyTypeCode,
            makeCode: input.makeCode ?? null,
            modelCode: input.modelCode ?? null,
            year: input.year ?? null,
            colour: input.colour ?? null,
            useCategoryCode: input.useCategoryCode ?? null,
            seatingCapacity: input.seatingCapacity ?? null,
            fuelTypeCode: input.fuelTypeCode ?? null,
            fuelEfficiencyKmpl: input.fuelEfficiencyKmpl ?? null,
            ownership: input.ownership ?? 'Owned',
            purchaseOrLeaseStart: input.purchaseOrLeaseStart ?? null,
            leaseEnd: input.leaseEnd ?? null,
            purchaseCost: input.purchaseCost ?? null,
            monthlyRental: input.monthlyRental ?? null,
            currency: input.currency ?? 'AED',
            vendorId: input.vendorId ?? null,
            leaseContractId: input.leaseContractId ?? null,
            leaseContractRef: lease?.contractRef ?? null,
            mulkiyaNumber: input.mulkiyaNumber ?? null,
            mulkiyaExpiry: input.mulkiyaExpiry ?? null,
            insuranceProvider: input.insuranceProvider ?? null,
            insurancePolicyNumber: input.insurancePolicyNumber ?? null,
            insuranceExpiry: input.insuranceExpiry ?? null,
            salikTag: input.salikTag ?? null,
            darbTag: input.darbTag ?? null,
            fuelCardNumber: input.fuelCardNumber ?? null,
            operationalStatus: input.operationalStatus ?? null,
            bookingPoolFlag: input.bookingPoolFlag ?? false,
            assignmentModel: input.assignmentModel ?? 'Pool',
            assignedDriverPersonId: input.assignedDriverPersonId ?? null,
            trackerVendor: input.trackerVendor ?? null,
            trackerSerial: input.trackerSerial ?? null,
            gpsStatus: input.gpsStatus ?? 'NotInstalled',
          },
          tx,
        );
        await this.repo.insertHistory(
          {
            vehicleId: created.id,
            fromStatus: null,
            toStatus: created.lifecycleStatus,
            reason: 'onboarded',
            actorRef,
          },
          tx,
        );
        if (input.homeNodeId) {
          await this.repo.insertAssignment(
            {
              organizationId: created.organizationId,
              vehicleId: created.id,
              nodeId: input.homeNodeId,
            },
            tx,
          );
        }
        await this.audit.record(
          {
            actorRef,
            action: 'VEHICLE_CREATED',
            entityRef: `vehicle:${created.id}`,
            after: { plate: created.plate },
            organizationId,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'vehicle',
            aggregateId: created.id,
            eventType: 'VehicleChanged',
            payload: { change: 'created', plate: created.plate },
          },
          tx,
        );
        return this.toDto(created);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Returns a vehicle by id. */
  async get(id: string): Promise<VehicleDto> {
    return this.toDto(await this.require(id));
  }

  /** Lists vehicles (most-recent first). */
  async list(
    limit = 50,
    offset = 0,
    organizationId?: string,
    authorizedNodeIds?: string[],
    includeUnassigned = false,
    search?: string,
    sort?: string,
  ): Promise<VehicleDto[]> {
    const rows = await this.repo.list(
      limit,
      offset,
      organizationId,
      authorizedNodeIds,
      includeUnassigned,
      search,
      sort,
    );
    return rows.map((row) =>
      this.toDto(row.vehicle, {
        id: row.hierarchyNodeId,
        name: row.hierarchyNodeName,
        nameAr: row.hierarchyNodeNameAr,
      }),
    );
  }

  /** Count of scoped vehicles matching an optional search (for pagination). */
  async count(
    organizationId?: string,
    authorizedNodeIds?: string[],
    includeUnassigned = false,
    search?: string,
  ): Promise<number> {
    return this.repo.count(
      organizationId,
      authorizedNodeIds,
      includeUnassigned,
      search,
    );
  }

  /** Scoped registry summary counts (total/active/in-use/maintenance/blocked). */
  async summary(
    organizationId?: string,
    authorizedNodeIds?: string[],
    includeUnassigned = false,
  ) {
    return this.repo.summary(organizationId, authorizedNodeIds, includeUnassigned);
  }

  /** Lifecycle/operational history for a vehicle. */
  async history(id: string) {
    await this.require(id);
    return this.repo.listHistory(id);
  }

  /** Inter-node transfer history for a vehicle (newest first). */
  async transfers(id: string) {
    await this.require(id);
    return this.repo.listTransfers(id);
  }

  /** Returns the vehicle's currently effective hierarchy assignment, if any. */
  async activeScope(id: string): Promise<string | null> {
    await this.get(id);
    return (await this.repo.activeAssignment(id))?.nodeId ?? null;
  }

  /** Returns the organization owning a vehicle. */
  async organizationOf(id: string): Promise<string> {
    return (await this.require(id)).organizationId;
  }

  /** Patches mutable attributes (re-validates any classification codes). */
  async update(
    id: string,
    input: UpdateVehicle,
    actorRef = 'system',
  ): Promise<VehicleDto> {
    const existing = await this.require(id);
    if (
      existing.vendorHealthHold &&
      (input.bookingPoolFlag === true ||
        (input.operationalStatus !== undefined &&
          input.operationalStatus !== 'Quarantined'))
    ) {
      throw new ConflictException({
        title: 'Vehicle is held by Vendor or lease health',
        reasons: [
          'vehicle-vendor-health-hold-active',
          existing.vendorHealthHoldReason ?? 'vendor-health-unavailable',
        ],
      });
    }
    // A Dedicated vehicle must keep an assigned driver (invariant, not only at create).
    if (
      existing.assignmentModel === 'Dedicated' &&
      input.assignedDriverPersonId === null
    ) {
      throw new BadRequestException({
        title: 'Dedicated vehicle needs a driver',
        reasons: ['dedicated-requires-driver'],
      });
    }
    if (input.useCategoryCode)
      await this.requireLookup('use-category', input.useCategoryCode);
    if (input.fuelTypeCode)
      await this.requireLookup('fuel-type', input.fuelTypeCode);
    if (input.bookingPoolFlag) {
      this.assertPoolActivation({
        ...input,
        mulkiyaNumber:
          input.mulkiyaNumber ?? existing.mulkiyaNumber ?? undefined,
        mulkiyaExpiry:
          input.mulkiyaExpiry ?? existing.mulkiyaExpiry ?? undefined,
        insurancePolicyNumber:
          input.insurancePolicyNumber ??
          existing.insurancePolicyNumber ??
          undefined,
        insuranceExpiry:
          input.insuranceExpiry ?? existing.insuranceExpiry ?? undefined,
      });
    }
    try {
      return await this.repo.transaction(async (tx) => {
        const updated = await this.repo.update(id, { ...input }, tx);
        await this.audit.record(
          {
            actorRef,
            action: 'VEHICLE_UPDATED',
            entityRef: `vehicle:${id}`,
            before: { plate: existing.plate },
            after: { ...input },
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'vehicle',
            aggregateId: id,
            eventType: 'VehicleChanged',
            payload: { change: 'updated' },
          },
          tx,
        );
        return this.toDto(updated);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Records a lifecycle transition (guarded), with history + audit + event. */
  async transition(
    id: string,
    input: VehicleTransition,
    actorRef = 'system',
  ): Promise<VehicleDto> {
    const existing = await this.require(id);
    const from = existing.lifecycleStatus as VehicleLifecycleStatus;
    try {
      assertTransition(from, input.toStatus);
    } catch {
      throw new ConflictException({
        title: 'Invalid lifecycle transition',
        reasons: [`vehicle-transition-invalid:${from}->${input.toStatus}`],
      });
    }
    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(
        id,
        { lifecycleStatus: input.toStatus },
        tx,
      );
      await this.repo.insertHistory(
        {
          vehicleId: id,
          fromStatus: from,
          toStatus: input.toStatus,
          reason: input.reason ?? null,
          actorRef,
        },
        tx,
      );
      await this.audit.record(
        {
          actorRef,
          action: 'VEHICLE_TRANSITION',
          entityRef: `vehicle:${id}`,
          before: { status: from },
          after: { status: input.toStatus },
          reason: input.reason,
        },
        tx,
      );
      await this.outbox.enqueue(
        {
          aggregateType: 'vehicle',
          aggregateId: id,
          eventType: 'VehicleChanged',
          payload: { change: 'transition', from, to: input.toStatus },
        },
        tx,
      );
      return this.toDto(updated);
    });
  }

  private async require(id: string): Promise<VehicleRow> {
    const found = await this.repo.findById(id);
    if (!found) {
      throw new NotFoundException({
        title: 'Unknown vehicle',
        reasons: [`vehicle-not-found:${id}`],
      });
    }
    return found;
  }

  private async validateClassification(input: CreateVehicle): Promise<void> {
    await this.requireLookup('vehicle-body-type', input.bodyTypeCode);
    if (input.useCategoryCode)
      await this.requireLookup('use-category', input.useCategoryCode);
    if (input.fuelTypeCode)
      await this.requireLookup('fuel-type', input.fuelTypeCode);
    if (input.makeCode)
      await this.requireLookup('vehicle-make', input.makeCode);
    if (input.makeCode && input.modelCode) {
      const models = await this.lookups.getChildren(
        'vehicle-make',
        input.makeCode,
      );
      if (!models.some((m) => m.code === input.modelCode)) {
        throw new BadRequestException({
          title: 'Invalid model for make',
          reasons: [`invalid-model:${input.makeCode}:${input.modelCode}`],
        });
      }
    }
  }

  private async requireLookup(typeCode: string, code: string): Promise<void> {
    const values = await this.lookups.getValues(typeCode);
    if (!values.some((v) => v.code === code)) {
      throw new BadRequestException({
        title: 'Invalid lookup code',
        reasons: [`invalid-lookup:${typeCode}:${code}`],
      });
    }
  }

  /** Requires current registration and insurance before entering the booking pool. */
  private assertPoolActivation(input: {
    bookingPoolFlag?: boolean;
    mulkiyaNumber?: string;
    mulkiyaExpiry?: string;
    insurancePolicyNumber?: string;
    insuranceExpiry?: string;
  }): void {
    if (!input.bookingPoolFlag) return;
    const today = new Date().toISOString().slice(0, 10);
    const reasons: string[] = [];
    if (!input.mulkiyaNumber) reasons.push('vehicle-mulkiya-required-for-pool');
    if (!input.mulkiyaExpiry || input.mulkiyaExpiry < today) {
      reasons.push('vehicle-mulkiya-not-current-for-pool');
    }
    if (!input.insurancePolicyNumber)
      reasons.push('vehicle-insurance-required-for-pool');
    if (!input.insuranceExpiry || input.insuranceExpiry < today) {
      reasons.push('vehicle-insurance-not-current-for-pool');
    }
    if (reasons.length) {
      throw new BadRequestException({
        title: 'Vehicle is not compliant for booking-pool activation',
        reasons,
      });
    }
  }

  private toDto(
    v: VehicleRow,
    hierarchyNode?: {
      id: string | null;
      name: string | null;
      nameAr: string | null;
    },
  ): VehicleDto {
    return {
      id: v.id,
      plate: v.plate,
      chassisVin: v.chassisVin,
      bodyTypeCode: v.bodyTypeCode,
      makeCode: v.makeCode,
      modelCode: v.modelCode,
      useCategoryCode: v.useCategoryCode,
      fuelTypeCode: v.fuelTypeCode,
      fuelEfficiencyKmpl: v.fuelEfficiencyKmpl,
      ownership: v.ownership,
      purchaseOrLeaseStart: v.purchaseOrLeaseStart,
      leaseEnd: v.leaseEnd,
      purchaseCost: v.purchaseCost,
      monthlyRental: v.monthlyRental,
      currency: v.currency,
      vendorId: v.vendorId,
      leaseContractId: v.leaseContractId,
      leaseContractRef: v.leaseContractRef,
      lifecycleStatus: v.lifecycleStatus,
      operationalStatus: v.operationalStatus,
      lastConfirmedOdometer: v.lastConfirmedOdometer,
      bookingPoolFlag: v.bookingPoolFlag,
      vendorHealthHold: v.vendorHealthHold,
      vendorHealthHoldReason: v.vendorHealthHoldReason,
      assignmentModel: v.assignmentModel,
      assignedDriverPersonId: v.assignedDriverPersonId,
      fuelCardNumber: v.fuelCardNumber,
      salikTag: v.salikTag,
      darbTag: v.darbTag,
      trackerVendor: v.trackerVendor,
      trackerSerial: v.trackerSerial,
      gpsStatus: v.gpsStatus,
      mulkiyaNumber: v.mulkiyaNumber,
      mulkiyaExpiry: v.mulkiyaExpiry,
      insuranceProvider: v.insuranceProvider,
      insurancePolicyNumber: v.insurancePolicyNumber,
      insuranceExpiry: v.insuranceExpiry,
      year: v.year,
      colour: v.colour,
      seatingCapacity: v.seatingCapacity,
      sim: v.sim,
      nextMaintenanceDue: v.nextMaintenanceDue,
      insuranceCoverageType: v.insuranceCoverageType,
      depreciationRate: v.depreciationRate,
      hierarchyNodeId: hierarchyNode?.id ?? null,
      hierarchyNodeName: hierarchyNode?.name ?? null,
      hierarchyNodeNameAr: hierarchyNode?.nameAr ?? null,
    };
  }
}
