import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { VENDOR_REASON } from '../src/contracts/vendor.contract';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { REDIS } from '../src/common/redis/redis.constants';
import type { Redis } from 'ioredis';
import { IntegratedVendorProvider } from '../src/modules/vendors/providers/integrated-vendor.provider';
import { VendorRepository } from '../src/modules/vendors/repositories/vendor.repository';
import { VendorSourceResolver } from '../src/modules/vendors/services/vendor-source.resolver';
import { VendorService } from '../src/modules/vendors/services/vendor.service';
import { VehicleService } from '../src/modules/vehicles/services/vehicle.service';
import { BookingService } from '../src/modules/bookings/services/booking.service';
import { LookupService } from '../src/modules/config/services/lookup.service';
import { AuditService } from '../src/modules/platform/services/audit.service';
import type { Principal } from '../src/common/auth/principal';

const KHALIFA_SCOPE_ID = 'a0000000-0000-4000-8000-000000000003';
const fleetPrincipal: Principal = { organizationId: '00000000-0000-4000-8000-000000000001', userId: null, personId: 'b0000000-0000-4000-8000-000000000006', entraObjectId: null, email: null, roles: [{ role: 'GroupFleetLead', scopeNodeId: KHALIFA_SCOPE_ID }], isDevLogin: true };

/**
 * Vendor master + lease contracts (S1/S2), incl. the plug-and-play source seam.
 * Requires the test Postgres + Redis. The `vendor-category` lookup is seeded by
 * migration 0032; we only flush its cache key so `getValues` reflects the seed.
 */
describe('vendor master (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let vendors: VendorService;
  let integrated: IntegratedVendorProvider;
  let sources: VendorSourceResolver;
  let vehicles: VehicleService;
  let bookings: BookingService;
  let db: DrizzleDatabase;
  let redis: Redis;
  let vendorRepository: VendorRepository;
  let lookupService: LookupService;
  let auditService: AuditService;

  const suffix = randomUUID().slice(0, 8);
  const createdVendorIds: string[] = [];
  const createdVehicleIds: string[] = [];

  const baseVendor = (over: Record<string, unknown> = {}) => {
    const uid = randomUUID().slice(0, 8);
    return {
      legalName: `Al Wathba Leasing ${uid}`,
      categoryCode: 'LESSOR',
      tradeLicenceNumber: `CN-${uid}`,
      taxRegistrationNumber: `TRN-${uid}`,
      bankIban: 'AE070331234567890123456',
      ...over,
    };
  };

  async function confirmRequiredDocuments(
    vendorId: string,
    actorRef = 'data-steward',
  ): Promise<void> {
    await redis.del('lookup:type:vendor-document-type');
    for (const [documentTypeCode, tracksExpiry] of [
      ['TRADE_LICENCE', true],
      ['LIABILITY_INSURANCE', true],
      ['MASTER_SERVICE_AGREEMENT', false],
    ] as const) {
      const document = await vendors.createDocument(
        vendorId,
        {
          documentTypeCode,
          documentReference: `${documentTypeCode}-${suffix}-${randomUUID().slice(0, 6)}`,
          blobRef: `vendor-documents/${vendorId}/${documentTypeCode.toLowerCase()}.pdf`,
          issueDate: tracksExpiry ? '2026-01-01' : undefined,
          expiryDate: tracksExpiry ? '2999-12-31' : undefined,
        },
        'document-maker',
      );
      await vendors.confirmDocument(vendorId, document.id, {}, actorRef);
    }
  }

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    vendors = ctx.get(VendorService);
    integrated = ctx.get(IntegratedVendorProvider);
    sources = ctx.get(VendorSourceResolver);
    vehicles = ctx.get(VehicleService);
    bookings = ctx.get(BookingService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    redis = ctx.get<Redis>(REDIS);
    vendorRepository = ctx.get(VendorRepository);
    lookupService = ctx.get(LookupService);
    auditService = ctx.get(AuditService);
    // The migration seeds vendor-category directly in the DB; flush the cache.
    await redis.del('lookup:type:vendor-category');
  });

  afterAll(async () => {
    for (const id of createdVehicleIds) {
      await db.execute(
        sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.vehicle_lifecycle_history WHERE vehicle_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`,
      );
      await db.execute(sql`DELETE FROM fleet.vehicle WHERE id = ${id}`);
    }
    for (const id of createdVendorIds) {
      await db.execute(
        sql`UPDATE fleet.vendor_document SET superseded_by_id = NULL WHERE vendor_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.vendor_document WHERE vendor_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.lease_contract WHERE vendor_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.vendor_onboarding_profile WHERE vendor_id = ${id}`,
      );
      await db.execute(
        sql`DELETE FROM fleet.outbox_event WHERE aggregate_id = ${id}`,
      );
      await db.execute(sql`DELETE FROM fleet.vendor WHERE id = ${id}`);
    }
    await ctx?.close();
  });

  it('creates a Manual vendor as Draft, flagged for verification, with a masked IBAN', async () => {
    const created = await vendors.create(baseVendor(), 'tester');
    createdVendorIds.push(created.id);
    expect(created.status).toBe('Draft');
    expect(created.sourceMode).toBe('Manual');
    expect(created.dataQualityFlag).toBe(true);
    expect(created.categoryCode).toBe('LESSOR');
    // IBAN is masked: first 2 + last 4 visible, middle hidden, never stored raw.
    expect(created.bankIbanMasked).toMatch(/^AE\*+3456$/);
    expect(created.bankIbanMasked).not.toContain('0331234567890');
  });

  it('persists onboarding defaults and computes evidence completeness in organization scope', async () => {
    const created = await vendors.create(
      baseVendor({
        primaryContactName: 'M. Vendor',
        primaryContactEmail: 'vendor@example.test',
        primaryContactPhone: '+971500000001',
        paymentTerms: 'Net 45',
      }),
      'tester',
    );
    createdVendorIds.push(created.id);

    const onboarding = await vendors.updateOnboardingProfile(
      created.id,
      {
        standardOffHireNoticeDays: 30,
        earlyTerminationPenalty: 'AED 4,500 per vehicle',
        renewalOptions: '2 x 12 months',
        escalationClause: 'CPI capped at 3%',
        replacementClause: 'Like-for-like within 48h',
        alertLadder: '90/60/30',
        accessMode: 'ManualInternal',
      },
      'tester',
    );

    expect(onboarding.profile).toMatchObject({
      standardOffHireNoticeDays: 30,
      accessMode: 'ManualInternal',
      alertLadder: '90/60/30',
    });
    expect(onboarding.completeness.canSubmit).toBe(true);
    expect(onboarding.completeness.canActivate).toBe(false);
    expect(onboarding.completeness.missing).toEqual(
      expect.arrayContaining([
        'documents.TRADE_LICENCE',
        'documents.LIABILITY_INSURANCE',
        'documents.MASTER_SERVICE_AGREEMENT',
      ]),
    );

    await expect(
      vendors.getOnboarding(
        created.id,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an unknown vendor category', async () => {
    await expect(
      vendors.create(baseVendor({ categoryCode: 'NOT_A_CATEGORY' }), 'tester'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to create an Integrated (externally-mastered) vendor in-app', async () => {
    await expect(
      vendors.create(
        baseVendor({ sourceMode: 'Integrated', externalRef: 'SUP-104482' }),
        'tester',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps externally mastered vendors read-only for in-app lifecycle actions', async () => {
    const integratedVendorId = randomUUID();
    createdVendorIds.push(integratedVendorId);
    await db.execute(sql`
      INSERT INTO fleet.vendor (
        id,
        legal_name,
        category_code,
        source_mode,
        external_ref,
        status,
        created_by_actor_ref
      ) VALUES (
        ${integratedVendorId},
        ${`Integrated Vendor ${suffix}`},
        'LESSOR',
        'Integrated',
        ${`EXT-${suffix}`},
        'Draft',
        'integration-sync'
      )
    `);

    await expect(
      vendors.transition(
        integratedVendorId,
        'PendingApproval',
        'VENDOR_SUBMITTED',
        'admin',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('runs the Procurement approval lifecycle and clears the data-quality flag (SoD)', async () => {
    const created = await vendors.create(baseVendor(), 'admin');
    createdVendorIds.push(created.id);

    const submitted = await vendors.transition(
      created.id,
      'PendingApproval',
      'VENDOR_SUBMITTED',
      'admin',
    );
    expect(submitted.status).toBe('PendingApproval');

    await expect(
      vendors.transition(
        created.id,
        'Active',
        'VENDOR_APPROVED',
        'procurement',
        undefined,
        true,
      ),
    ).rejects.toMatchObject({
      response: {
        reasons: expect.arrayContaining([
          VENDOR_REASON.activationEvidenceIncomplete,
        ]),
      },
    });
    await confirmRequiredDocuments(created.id);

    const approved = await vendors.transition(
      created.id,
      'Active',
      'VENDOR_APPROVED',
      'procurement',
      undefined,
      true,
    );
    expect(approved.status).toBe('Active');
    expect(approved.dataQualityFlag).toBe(false);
  });

  it('lists Pending Approval evidence and records an immutable request-change decision', async () => {
    const created = await vendors.create(
      baseVendor({
        primaryContactName: 'Approval Contact',
        primaryContactEmail: 'approval@example.test',
        primaryContactPhone: '+971500000002',
        paymentTerms: 'Net 45',
      }),
      'approval-maker',
    );
    createdVendorIds.push(created.id);
    await vendors.updateOnboardingProfile(
      created.id,
      {
        standardOffHireNoticeDays: 30,
        earlyTerminationPenalty: 'AED 4,500 per vehicle',
        renewalOptions: '2 x 12 months',
        escalationClause: 'CPI capped at 3%',
        replacementClause: 'Like-for-like within 48h',
        alertLadder: '90/60/30',
        accessMode: 'ManualInternal',
      },
      'approval-maker',
    );
    const submitted = await vendors.transition(
      created.id,
      'PendingApproval',
      'VENDOR_SUBMITTED',
      'approval-submitter',
    );
    expect(submitted.status).toBe('PendingApproval');

    const worklist = await vendors.listApprovalWorkItems(50, 0);
    expect(worklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vendorId: created.id,
          makerActorRef: 'approval-maker',
          submitterActorRef: 'approval-submitter',
          submittedAtUtc: expect.any(String),
          assignedAuthorityRole: 'Procurement',
          completeness: expect.objectContaining({ canActivate: false }),
          changeSummary: expect.objectContaining({ termsCaptured: true }),
        }),
      ]),
    );
    await expect(
      vendors.listApprovalWorkItems(
        50,
        0,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
    ).resolves.toEqual([]);

    const changed = await vendors.requestChanges(
      created.id,
      'Provide current liability insurance evidence.',
      'procurement-reviewer',
    );
    expect(changed.status).toBe('Draft');
    const auditRows = (await db.execute(sql`
      SELECT actor_ref, action, reason
      FROM fleet.audit_log
      WHERE entity_ref = ${`vendor:${created.id}`}
        AND action = 'VENDOR_CHANGE_REQUESTED'
    `)) as unknown as Array<{
      actor_ref: string;
      action: string;
      reason: string;
    }>;
    expect(auditRows).toEqual([
      expect.objectContaining({
        actor_ref: 'procurement-reviewer',
        action: 'VENDOR_CHANGE_REQUESTED',
        reason: 'Provide current liability insurance evidence.',
      }),
    ]);
    await expect(auditService.verifyChain()).resolves.toBe(true);
  });

  it('prevents a vendor creator or submitter from approving the same vendor', async () => {
    const createdByMaker = await vendors.create(baseVendor(), 'maker');
    createdVendorIds.push(createdByMaker.id);
    await vendors.transition(
      createdByMaker.id,
      'PendingApproval',
      'VENDOR_SUBMITTED',
      'submitter',
    );
    await confirmRequiredDocuments(createdByMaker.id);

    await expect(
      vendors.transition(
        createdByMaker.id,
        'Active',
        'VENDOR_APPROVED',
        'maker',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      vendors.transition(
        createdByMaker.id,
        'Active',
        'VENDOR_APPROVED',
        'submitter',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const approved = await vendors.transition(
      createdByMaker.id,
      'Active',
      'VENDOR_APPROVED',
      'procurement-approver',
      undefined,
      true,
    );
    expect(approved.status).toBe('Active');
  });

  it('rejects an invalid lifecycle transition', async () => {
    const created = await vendors.create(baseVendor(), 'admin');
    createdVendorIds.push(created.id);
    // Draft cannot jump straight to Active.
    await expect(
      vendors.transition(created.id, 'Active', 'VENDOR_APPROVED', 'admin'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('only allows a lease contract once its vendor is Active', async () => {
    const created = await vendors.create(baseVendor(), 'admin');
    createdVendorIds.push(created.id);

    await expect(
      vendors.createLease(
        { vendorId: created.id, contractRef: `LC-${suffix}` },
        'admin',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await vendors.transition(
      created.id,
      'PendingApproval',
      'VENDOR_SUBMITTED',
      'admin',
    );
    await confirmRequiredDocuments(created.id);
    await vendors.transition(
      created.id,
      'Active',
      'VENDOR_APPROVED',
      'procurement',
      undefined,
      true,
    );

    const lease = await vendors.createLease(
      {
        vendorId: created.id,
        contractRef: `LC-${suffix}`,
        monthlyAmount: '3150',
        alertLadder: '90/60/30',
      },
      'admin',
    );
    expect(lease.contractRef).toBe(`LC-${suffix}`);
    expect(lease.status).toBe('Active');
    expect(lease.monthlyAmount).toMatch(/^3150(\.0+)?$/);
    expect(lease.alertLadder).toBe('90/60/30');
  });

  it('treats vendor integration as future scope (sync not implemented)', async () => {
    await expect(integrated.sync()).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it('fails closed when a vendor source has no registered provider', () => {
    expect(() => sources.resolve('Unknown' as never)).toThrow(
      InternalServerErrorException,
    );
  });

  it('does not expose or attach vendors across organization boundaries', async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const created = await vendors.create(
      baseVendor(),
      'tenant-admin',
      organizationId,
    );
    createdVendorIds.push(created.id);

    await expect(
      vendors.get(created.id, otherOrganizationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      vendors.update(
        created.id,
        { legalName: 'Cross-tenant overwrite' },
        'other-admin',
        otherOrganizationId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      vendors.createLease(
        { vendorId: created.id, contractRef: `CROSS-${suffix}` },
        'other-admin',
        otherOrganizationId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a leased vehicle from an active governed vendor contract', async () => {
    const vendor = await vendors.create(baseVendor(), 'admin');
    createdVendorIds.push(vendor.id);
    await vendors.transition(
      vendor.id,
      'PendingApproval',
      'VENDOR_SUBMITTED',
      'admin',
    );
    await confirmRequiredDocuments(vendor.id);
    await vendors.transition(
      vendor.id,
      'Active',
      'VENDOR_APPROVED',
      'procurement',
      undefined,
      true,
    );
    const lease = await vendors.createLease(
      {
        vendorId: vendor.id,
        contractRef: `VEH-LC-${suffix}`,
        endDate: '2999-12-31',
      },
      'admin',
    );

    const vehicle = await vehicles.create(
      {
        plate: `LEASE-${suffix}`,
        chassisVin: `LEASE-VIN-${suffix}`,
        bodyTypeCode: 'SEDAN',
        ownership: 'Leased',
        vendorId: vendor.id,
        leaseContractId: lease.id,
        homeNodeId: KHALIFA_SCOPE_ID,
        bookingPoolFlag: true,
        mulkiyaNumber: `REG-${suffix}`,
        mulkiyaExpiry: '2999-12-31',
        insurancePolicyNumber: `POL-${suffix}`,
        insuranceExpiry: '2999-12-31',
      },
      'fleet-admin',
    );
    createdVehicleIds.push(vehicle.id);

    expect(vehicle.vendorId).toBe(vendor.id);
    expect(vehicle.leaseContractId).toBe(lease.id);
    expect(vehicle.leaseContractRef).toBe(lease.contractRef);

    const available = await bookings.availability({
      pickupAtUtc: '2999-11-01T08:00:00.000Z',
      returnAtUtc: '2999-11-01T10:00:00.000Z',
    }, fleetPrincipal);
    const availableVehicle = available.find(
      (candidate) => candidate.vehicleId === vehicle.id,
    );
    expect(availableVehicle).toBeDefined();
    expect(availableVehicle).not.toHaveProperty('vendorId');
    expect(availableVehicle).not.toHaveProperty('leaseContractId');

    await vendors.transition(
      vendor.id,
      'Suspended',
      'VENDOR_SUSPENDED',
      'vendor-health-admin',
      'Vendor compliance review',
    );
    expect(await vehicles.get(vehicle.id)).toMatchObject({
      operationalStatus: 'Quarantined',
      bookingPoolFlag: false,
      vendorHealthHold: true,
      vendorHealthHoldReason: 'vendor-status:Suspended',
    });
    expect(
      await bookings.availability({
        pickupAtUtc: '2999-11-01T08:00:00.000Z',
        returnAtUtc: '2999-11-01T10:00:00.000Z',
      }, fleetPrincipal),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ vehicleId: vehicle.id }),
      ]),
    );
    await expect(
      vehicles.update(
        vehicle.id,
        { bookingPoolFlag: true, operationalStatus: null },
        'fleet-override',
      ),
    ).rejects.toMatchObject({
      response: {
        reasons: expect.arrayContaining([
          'vehicle-vendor-health-hold-active',
        ]),
      },
    });
    await expect(
      vendors.reconcileAllLinkedVehicleHealth('health-worker'),
    ).resolves.toEqual({ held: 0, released: 0, updated: 0 });

    await vendors.transition(
      vendor.id,
      'Active',
      'VENDOR_REACTIVATED',
      'vendor-health-admin',
      'Vendor evidence restored',
    );
    expect(await vehicles.get(vehicle.id)).toMatchObject({
      operationalStatus: null,
      bookingPoolFlag: true,
      vendorHealthHold: false,
      vendorHealthHoldReason: null,
    });

    await vendors.updateLease(
      lease.id,
      { status: 'Suspended' },
      'procurement-health',
    );
    expect(await vehicles.get(vehicle.id)).toMatchObject({
      operationalStatus: 'Quarantined',
      bookingPoolFlag: false,
      vendorHealthHold: true,
      vendorHealthHoldReason: 'lease-status:Suspended',
    });
    await vendors.updateLease(
      lease.id,
      { status: 'Active' },
      'procurement-health',
    );
    expect(await vehicles.get(vehicle.id)).toMatchObject({
      operationalStatus: null,
      bookingPoolFlag: true,
      vendorHealthHold: false,
    });

    await vendors.updateLease(
      lease.id,
      { endDate: '2000-01-01' },
      'procurement-health',
    );
    expect(await vehicles.get(vehicle.id)).toMatchObject({
      vendorHealthHold: true,
      vendorHealthHoldReason: 'lease-expired:2000-01-01',
      bookingPoolFlag: false,
    });
    await vendors.updateLease(
      lease.id,
      { endDate: '2999-12-31' },
      'procurement-health',
    );
    expect(await vehicles.get(vehicle.id)).toMatchObject({
      vendorHealthHold: false,
      bookingPoolFlag: true,
    });
    expect(
      await bookings.availability({
        pickupAtUtc: '2999-11-01T08:00:00.000Z',
        returnAtUtc: '2999-11-01T10:00:00.000Z',
      }, fleetPrincipal),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ vehicleId: vehicle.id }),
      ]),
    );

    await db.execute(sql`
      UPDATE fleet.lease_contract
      SET end_date = '2000-01-01'
      WHERE id = ${lease.id}
    `);
    await expect(
      vendors.reconcileAllLinkedVehicleHealth('vendor-health-scheduler'),
    ).resolves.toMatchObject({ held: 1 });
    expect(await vehicles.get(vehicle.id)).toMatchObject({
      vendorHealthHold: true,
      bookingPoolFlag: false,
      vendorHealthHoldReason: 'lease-expired:2000-01-01',
    });
    await db.execute(sql`
      UPDATE fleet.lease_contract
      SET end_date = '2999-12-31'
      WHERE id = ${lease.id}
    `);
    await expect(
      vendors.reconcileAllLinkedVehicleHealth('vendor-health-scheduler'),
    ).resolves.toMatchObject({ released: 1 });
    expect(await vehicles.get(vehicle.id)).toMatchObject({
      vendorHealthHold: false,
      bookingPoolFlag: true,
    });
    const healthHistory = (await db.execute(sql`
      SELECT reason FROM fleet.vehicle_lifecycle_history
      WHERE vehicle_id = ${vehicle.id}
        AND reason LIKE 'vendor-health-%'
      ORDER BY at_utc
    `)) as unknown as Array<{ reason: string }>;
    expect(healthHistory).toHaveLength(8);
    expect(await auditService.verifyChain()).toBe(true);

    await vendors.transition(
      vendor.id,
      'Retired',
      'VENDOR_RETIRED',
      'vendor-health-admin',
      'Commercial relationship ended',
    );
    expect(await vehicles.get(vehicle.id)).toMatchObject({
      operationalStatus: 'Quarantined',
      bookingPoolFlag: false,
      vendorHealthHold: true,
      vendorHealthHoldReason: 'vendor-status:Retired',
    });
    expect(
      await bookings.availability({
        pickupAtUtc: '2999-11-01T08:00:00.000Z',
        returnAtUtc: '2999-11-01T10:00:00.000Z',
      }, fleetPrincipal),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ vehicleId: vehicle.id }),
      ]),
    );
    expect(await auditService.verifyChain()).toBe(true);
  });

  it('rejects mismatched, expired, and inactive vendor leases for vehicles', async () => {
    const firstVendor = await vendors.create(baseVendor(), 'first-maker');
    const secondVendor = await vendors.create(baseVendor(), 'second-maker');
    createdVendorIds.push(firstVendor.id, secondVendor.id);

    for (const [vendor, maker] of [
      [firstVendor, 'first-maker'],
      [secondVendor, 'second-maker'],
    ] as const) {
      await vendors.transition(
        vendor.id,
        'PendingApproval',
        'VENDOR_SUBMITTED',
        maker,
      );
      await confirmRequiredDocuments(vendor.id);
      await vendors.transition(
        vendor.id,
        'Active',
        'VENDOR_APPROVED',
        'procurement-approver',
        undefined,
        true,
      );
    }

    const secondVendorLease = await vendors.createLease(
      {
        vendorId: secondVendor.id,
        contractRef: `MISMATCH-${suffix}`,
        endDate: '2999-12-31',
      },
      'admin',
    );
    await expect(
      vendors.requireUsableVehicleLease(firstVendor.id, secondVendorLease.id),
    ).rejects.toBeInstanceOf(ConflictException);

    const expiredLease = await vendors.createLease(
      {
        vendorId: firstVendor.id,
        contractRef: `EXPIRED-${suffix}`,
        endDate: '2000-01-01',
      },
      'admin',
    );
    await expect(
      vendors.requireUsableVehicleLease(firstVendor.id, expiredLease.id),
    ).rejects.toBeInstanceOf(ConflictException);

    const activeLease = await vendors.createLease(
      {
        vendorId: firstVendor.id,
        contractRef: `SUSPEND-${suffix}`,
        endDate: '2999-12-31',
      },
      'admin',
    );
    await vendors.transition(
      firstVendor.id,
      'Suspended',
      'VENDOR_SUSPENDED',
      'admin',
    );
    await expect(
      vendors.requireUsableVehicleLease(firstVendor.id, activeLease.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates, confirms, and supersedes immutable Vendor document versions', async () => {
    await redis.del('lookup:type:vendor-document-type');
    const vendor = await vendors.create(baseVendor(), 'document-maker');
    createdVendorIds.push(vendor.id);

    const first = await vendors.createDocument(
      vendor.id,
      {
        documentTypeCode: 'TRADE_LICENCE',
        documentReference: `DOC-${suffix}-V1`,
        blobRef: `vendor-documents/${vendor.id}/trade-licence-v1.pdf`,
        issueDate: '2026-01-01',
        expiryDate: '2027-01-01',
      },
      'document-maker',
    );
    expect(first).toMatchObject({
      version: 1,
      status: 'PendingConfirmation',
    });

    const confirmedFirst = await vendors.confirmDocument(
      vendor.id,
      first.id,
      { confirmedMetadata: { manuallyConfirmed: true } },
      'data-steward',
    );
    expect(confirmedFirst).toMatchObject({
      status: 'Confirmed',
      confirmedByActorRef: 'data-steward',
    });

    const replacement = await vendors.supersedeDocument(
      vendor.id,
      first.id,
      {
        documentTypeCode: 'TRADE_LICENCE',
        documentReference: `DOC-${suffix}-V2`,
        blobRef: `vendor-documents/${vendor.id}/trade-licence-v2.pdf`,
        issueDate: '2027-01-01',
        expiryDate: '2028-01-01',
      },
      'document-maker',
    );
    expect(replacement).toMatchObject({
      version: 2,
      status: 'PendingConfirmation',
    });
    expect(await vendors.getDocument(vendor.id, first.id)).toMatchObject({
      status: 'Confirmed',
      supersededById: replacement.id,
    });

    await vendors.confirmDocument(
      vendor.id,
      replacement.id,
      { confirmedMetadata: { manuallyConfirmed: true } },
      'procurement-reviewer',
    );
    expect(await vendors.getDocument(vendor.id, first.id)).toMatchObject({
      status: 'Superseded',
      supersededById: replacement.id,
    });
    expect(await vendors.getDocument(vendor.id, replacement.id)).toMatchObject({
      status: 'Confirmed',
      version: 2,
    });
  });

  it('rejects invalid types, dates, cross-organization access, and Integrated document writes', async () => {
    await redis.del('lookup:type:vendor-document-type');
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const vendor = await vendors.create(
      baseVendor(),
      'document-maker',
      organizationId,
    );
    createdVendorIds.push(vendor.id);

    await expect(
      vendors.createDocument(
        vendor.id,
        {
          documentTypeCode: 'UNKNOWN',
          blobRef: 'vendor-documents/unknown/document.pdf',
        },
        'document-maker',
        organizationId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      vendors.createDocument(
        vendor.id,
        {
          documentTypeCode: 'TRADE_LICENCE',
          blobRef: 'https://storage.example/vendor-document.pdf',
        } as never,
        'document-maker',
        organizationId,
      ),
    ).rejects.toMatchObject({
      response: {
        reasons: [VENDOR_REASON.documentStorageRefInvalid],
      },
    });
    await expect(
      vendors.createDocument(
        vendor.id,
        {
          documentTypeCode: 'TRADE_LICENCE',
          blobRef: 'vendor-documents/invalid-dates/document.pdf',
          issueDate: '2027-01-01',
          expiryDate: '2026-01-01',
        },
        'document-maker',
        organizationId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      vendors.createDocument(
        vendor.id,
        {
          documentTypeCode: 'TRADE_LICENCE',
          blobRef: 'vendor-documents/cross-org/document.pdf',
        },
        'other-maker',
        otherOrganizationId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const integratedVendorId = randomUUID();
    createdVendorIds.push(integratedVendorId);
    await db.execute(sql`
      INSERT INTO fleet.vendor (
        id, legal_name, category_code, source_mode, external_ref, status,
        created_by_actor_ref
      ) VALUES (
        ${integratedVendorId}, ${`Document Integrated ${suffix}`}, 'LESSOR',
        'Integrated', ${`DOC-EXT-${suffix}`}, 'Draft', 'integration-sync'
      )
    `);
    await expect(
      vendors.createDocument(
        integratedVendorId,
        {
          documentTypeCode: 'TRADE_LICENCE',
          blobRef: 'vendor-documents/integrated/document.pdf',
        },
        'admin',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects document confirmation and rejection from invalid lifecycle states', async () => {
    await redis.del('lookup:type:vendor-document-type');
    const vendor = await vendors.create(baseVendor(), 'document-maker');
    createdVendorIds.push(vendor.id);
    const document = await vendors.createDocument(
      vendor.id,
      {
        documentTypeCode: 'MASTER_SERVICE_AGREEMENT',
        blobRef: `vendor-documents/${vendor.id}/msa.pdf`,
      },
      'document-maker',
    );
    await vendors.rejectDocument(
      vendor.id,
      document.id,
      'Signature is missing',
      'data-steward',
    );
    await expect(
      vendors.confirmDocument(vendor.id, document.id, {}, 'data-steward'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      vendors.rejectDocument(
        vendor.id,
        document.id,
        'Reject twice',
        'data-steward',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows only one pending version when document creation races', async () => {
    await redis.del('lookup:type:vendor-document-type');
    const vendor = await vendors.create(baseVendor(), 'document-maker');
    createdVendorIds.push(vendor.id);
    const input = {
      documentTypeCode: 'LIABILITY_INSURANCE',
      blobRef: `vendor-documents/${vendor.id}/insurance.pdf`,
    };
    const results = await Promise.allSettled([
      vendors.createDocument(vendor.id, input, 'maker-a'),
      vendors.createDocument(vendor.id, input, 'maker-b'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      (await vendors.listDocuments(vendor.id)).filter((document) =>
        ['Uploaded', 'PendingConfirmation'].includes(document.status),
      ),
    ).toHaveLength(1);
  });

  it('releases a confirmed version when its pending replacement is rejected', async () => {
    await redis.del('lookup:type:vendor-document-type');
    const vendor = await vendors.create(baseVendor(), 'document-maker');
    createdVendorIds.push(vendor.id);
    const original = await vendors.createDocument(
      vendor.id,
      {
        documentTypeCode: 'TRADE_LICENCE',
        blobRef: `vendor-documents/${vendor.id}/trade-original.pdf`,
      },
      'document-maker',
    );
    await vendors.confirmDocument(vendor.id, original.id, {}, 'data-steward');
    const rejectedReplacement = await vendors.supersedeDocument(
      vendor.id,
      original.id,
      {
        documentTypeCode: 'TRADE_LICENCE',
        blobRef: `vendor-documents/${vendor.id}/trade-rejected.pdf`,
      },
      'document-maker',
    );
    await vendors.rejectDocument(
      vendor.id,
      rejectedReplacement.id,
      'Unreadable scan',
      'data-steward',
    );
    expect(await vendors.getDocument(vendor.id, original.id)).toMatchObject({
      status: 'Confirmed',
      supersededById: null,
    });
    await expect(
      vendors.supersedeDocument(
        vendor.id,
        original.id,
        {
          documentTypeCode: 'TRADE_LICENCE',
          blobRef: `vendor-documents/${vendor.id}/trade-next.pdf`,
        },
        'document-maker',
      ),
    ).resolves.toMatchObject({ status: 'PendingConfirmation', version: 3 });
  });

  it('rolls back a document insert when outbox enqueue fails', async () => {
    await redis.del('lookup:type:vendor-document-type');
    const vendor = await vendors.create(baseVendor(), 'document-maker');
    createdVendorIds.push(vendor.id);
    const failingService = new VendorService(
      vendorRepository,
      lookupService,
      auditService,
      {
        enqueue: async () => {
          throw new Error('forced-outbox-failure');
        },
      } as never,
      sources,
    );

    await expect(
      failingService.createDocument(
        vendor.id,
        {
          documentTypeCode: 'MASTER_SERVICE_AGREEMENT',
          blobRef: `vendor-documents/${vendor.id}/rollback.pdf`,
        },
        'document-maker',
      ),
    ).rejects.toThrow('forced-outbox-failure');
    expect(await vendors.listDocuments(vendor.id)).toEqual([]);
  });
});
