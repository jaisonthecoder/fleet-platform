import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OutboxService } from '../../../common/messaging/outbox.service';
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

type VehicleRow = NonNullable<Awaited<ReturnType<VehicleRepository['findById']>>>;

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
  ) {}

  /** Creates a vehicle after validating its classification codes against lookups. */
  async create(input: CreateVehicle, actorRef = 'system', organizationId?: string): Promise<VehicleDto> {
    await this.validateClassification(input);
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
            leaseContractRef: input.leaseContractRef ?? null,
            mulkiyaNumber: input.mulkiyaNumber ?? null,
            mulkiyaExpiry: input.mulkiyaExpiry ?? null,
            insuranceProvider: input.insuranceProvider ?? null,
            insurancePolicyNumber: input.insurancePolicyNumber ?? null,
            insuranceExpiry: input.insuranceExpiry ?? null,
            salikTag: input.salikTag ?? null,
            darbTag: input.darbTag ?? null,
            assignmentModel: input.assignmentModel ?? 'Pool',
            assignedDriverPersonId: input.assignedDriverPersonId ?? null,
          },
          tx,
        );
        await this.repo.insertHistory(
          { vehicleId: created.id, fromStatus: null, toStatus: created.lifecycleStatus, reason: 'onboarded', actorRef },
          tx,
        );
        if (input.homeNodeId) {
          await this.repo.insertAssignment({ organizationId: created.organizationId, vehicleId: created.id, nodeId: input.homeNodeId }, tx);
        }
        await this.audit.record(
          { actorRef, action: 'VEHICLE_CREATED', entityRef: `vehicle:${created.id}`, after: { plate: created.plate } },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'vehicle', aggregateId: created.id, eventType: 'VehicleChanged', payload: { change: 'created', plate: created.plate } },
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
  async list(limit = 50, offset = 0, organizationId?: string): Promise<VehicleDto[]> {
    const rows = await this.repo.list(limit, offset, organizationId);
    return rows.map((row) => this.toDto(row));
  }

  /** Lifecycle/operational history for a vehicle. */
  async history(id: string) {
    await this.require(id);
    return this.repo.listHistory(id);
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
  async update(id: string, input: UpdateVehicle, actorRef = 'system'): Promise<VehicleDto> {
    const existing = await this.require(id);
    // A Dedicated vehicle must keep an assigned driver (invariant, not only at create).
    if (existing.assignmentModel === 'Dedicated' && input.assignedDriverPersonId === null) {
      throw new BadRequestException({
        title: 'Dedicated vehicle needs a driver',
        reasons: ['dedicated-requires-driver'],
      });
    }
    if (input.useCategoryCode) await this.requireLookup('use-category', input.useCategoryCode);
    if (input.fuelTypeCode) await this.requireLookup('fuel-type', input.fuelTypeCode);
    try {
      return await this.repo.transaction(async (tx) => {
        const updated = await this.repo.update(id, { ...input }, tx);
        await this.audit.record(
          { actorRef, action: 'VEHICLE_UPDATED', entityRef: `vehicle:${id}`, before: { plate: existing.plate }, after: { ...input } },
          tx,
        );
        await this.outbox.enqueue(
          { aggregateType: 'vehicle', aggregateId: id, eventType: 'VehicleChanged', payload: { change: 'updated' } },
          tx,
        );
        return this.toDto(updated);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Records a lifecycle transition (guarded), with history + audit + event. */
  async transition(id: string, input: VehicleTransition, actorRef = 'system'): Promise<VehicleDto> {
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
      const updated = await this.repo.update(id, { lifecycleStatus: input.toStatus }, tx);
      await this.repo.insertHistory(
        { vehicleId: id, fromStatus: from, toStatus: input.toStatus, reason: input.reason ?? null, actorRef },
        tx,
      );
      await this.audit.record(
        { actorRef, action: 'VEHICLE_TRANSITION', entityRef: `vehicle:${id}`, before: { status: from }, after: { status: input.toStatus }, reason: input.reason },
        tx,
      );
      await this.outbox.enqueue(
        { aggregateType: 'vehicle', aggregateId: id, eventType: 'VehicleChanged', payload: { change: 'transition', from, to: input.toStatus } },
        tx,
      );
      return this.toDto(updated);
    });
  }

  private async require(id: string): Promise<VehicleRow> {
    const found = await this.repo.findById(id);
    if (!found) {
      throw new NotFoundException({ title: 'Unknown vehicle', reasons: [`vehicle-not-found:${id}`] });
    }
    return found;
  }

  private async validateClassification(input: CreateVehicle): Promise<void> {
    await this.requireLookup('vehicle-body-type', input.bodyTypeCode);
    if (input.useCategoryCode) await this.requireLookup('use-category', input.useCategoryCode);
    if (input.fuelTypeCode) await this.requireLookup('fuel-type', input.fuelTypeCode);
    if (input.makeCode) await this.requireLookup('vehicle-make', input.makeCode);
    if (input.makeCode && input.modelCode) {
      const models = await this.lookups.getChildren('vehicle-make', input.makeCode);
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

  private toDto(v: VehicleRow): VehicleDto {
    return {
      id: v.id,
      plate: v.plate,
      chassisVin: v.chassisVin,
      bodyTypeCode: v.bodyTypeCode,
      makeCode: v.makeCode,
      modelCode: v.modelCode,
      useCategoryCode: v.useCategoryCode,
      fuelTypeCode: v.fuelTypeCode,
      ownership: v.ownership,
      lifecycleStatus: v.lifecycleStatus,
      operationalStatus: v.operationalStatus,
      bookingPoolFlag: v.bookingPoolFlag,
      assignmentModel: v.assignmentModel,
      assignedDriverPersonId: v.assignedDriverPersonId,
      mulkiyaExpiry: v.mulkiyaExpiry,
      insuranceExpiry: v.insuranceExpiry,
    };
  }
}
