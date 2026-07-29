import { VENDOR_REASON } from '../../../contracts/vendor.contract';
import { VendorService } from './vendor.service';

describe('VendorService document transaction', () => {
  it('holds linked Vehicles idempotently and restores their prior state when dependencies recover', async () => {
    const tx = {};
    const linkedVehicle = {
      id: 'vehicle-1',
      organizationId: 'org-1',
      operationalStatus: 'Standby',
      bookingPoolFlag: true,
      vendorHealthHold: false,
      vendorHealthHoldReason: null,
      vendorHealthPreviousOperationalStatus: null,
      vendorHealthPreviousBookingPoolFlag: null,
      vendorHealthHeldAtUtc: null,
      mulkiyaNumber: 'REG-1',
      mulkiyaExpiry: '2999-12-31',
      insurancePolicyNumber: 'POL-1',
      insuranceExpiry: '2999-12-31',
    };
    const healthRow = {
      vehicle: linkedVehicle,
      vendorStatus: 'Suspended',
      leaseStatus: 'Active',
      leaseEndDate: '2999-12-31',
    };
    const repo = {
      transaction: jest.fn(async (work: (executor: unknown) => unknown) =>
        work(tx),
      ),
      acquireVehicleHealthLock: jest.fn(),
      listLinkedVehicleHealth: jest.fn().mockResolvedValue([healthRow]),
      updateLinkedVehicle: jest.fn(
        async (_id: string, _org: string, set: Record<string, unknown>) => {
          Object.assign(linkedVehicle, set);
          return linkedVehicle;
        },
      ),
      insertVehicleHealthHistory: jest.fn(),
    };
    const audit = { record: jest.fn() };
    const outbox = { enqueue: jest.fn() };
    const service = new VendorService(
      repo as never,
      {} as never,
      audit as never,
      outbox as never,
      { assertManualWrite: jest.fn() } as never,
    );

    await expect(service.reconcileAllLinkedVehicleHealth()).resolves.toEqual({
      held: 1,
      released: 0,
      updated: 0,
    });
    expect(linkedVehicle).toMatchObject({
      operationalStatus: 'Quarantined',
      bookingPoolFlag: false,
      vendorHealthHold: true,
      vendorHealthPreviousOperationalStatus: 'Standby',
      vendorHealthPreviousBookingPoolFlag: true,
    });
    expect(repo.insertVehicleHealthHistory).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);

    await expect(service.reconcileAllLinkedVehicleHealth()).resolves.toEqual({
      held: 0,
      released: 0,
      updated: 0,
    });
    expect(repo.insertVehicleHealthHistory).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);

    healthRow.vendorStatus = 'Active';
    await expect(service.reconcileAllLinkedVehicleHealth()).resolves.toEqual({
      held: 0,
      released: 1,
      updated: 0,
    });
    expect(linkedVehicle).toMatchObject({
      operationalStatus: 'Standby',
      bookingPoolFlag: true,
      vendorHealthHold: false,
      vendorHealthHoldReason: null,
    });
    expect(repo.acquireVehicleHealthLock).toHaveBeenCalledTimes(3);
    expect(repo.insertVehicleHealthHistory).toHaveBeenCalledTimes(2);
  });

  it('does not restore booking-pool membership when Vehicle compliance expired during a hold', async () => {
    const linkedVehicle = {
      id: 'vehicle-1',
      organizationId: 'org-1',
      operationalStatus: 'Quarantined',
      bookingPoolFlag: false,
      vendorHealthHold: true,
      vendorHealthHoldReason: 'vendor-status:Suspended',
      vendorHealthPreviousOperationalStatus: null,
      vendorHealthPreviousBookingPoolFlag: true,
      vendorHealthHeldAtUtc: new Date(),
      mulkiyaNumber: 'REG-1',
      mulkiyaExpiry: '2020-01-01',
      insurancePolicyNumber: 'POL-1',
      insuranceExpiry: '2999-12-31',
    };
    const repo = {
      transaction: jest.fn(async (work: (executor: unknown) => unknown) =>
        work({}),
      ),
      acquireVehicleHealthLock: jest.fn(),
      listLinkedVehicleHealth: jest.fn().mockResolvedValue([
        {
          vehicle: linkedVehicle,
          vendorStatus: 'Active',
          leaseStatus: 'Active',
          leaseEndDate: '2999-12-31',
        },
      ]),
      updateLinkedVehicle: jest.fn(
        async (_id: string, _org: string, set: Record<string, unknown>) => {
          Object.assign(linkedVehicle, set);
          return linkedVehicle;
        },
      ),
      insertVehicleHealthHistory: jest.fn(),
    };
    const service = new VendorService(
      repo as never,
      {} as never,
      { record: jest.fn() } as never,
      { enqueue: jest.fn() } as never,
      { assertManualWrite: jest.fn() } as never,
    );

    await service.reconcileAllLinkedVehicleHealth();
    expect(linkedVehicle.bookingPoolFlag).toBe(false);
    expect(repo.insertVehicleHealthHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'vendor-health-restored-compliance-blocked',
      }),
      expect.anything(),
    );
  });

  it('requires an actionable reason before requesting Vendor changes', async () => {
    const service = new VendorService(
      {} as never,
      {} as never,
      { record: jest.fn() } as never,
      { enqueue: jest.fn() } as never,
      { assertManualWrite: jest.fn() } as never,
    );
    jest.spyOn(service, 'transition').mockResolvedValue({} as never);

    await expect(
      service.requestChanges('vendor-1', '   ', 'procurement', 'org-1'),
    ).rejects.toMatchObject({
      response: {
        reasons: ['vendor-change-request-reason-required'],
      },
    });
    expect(service.transition).not.toHaveBeenCalled();
  });

  it('projects Pending Approval work items with maker and completeness evidence', async () => {
    const now = new Date('2026-07-23T10:00:00Z');
    const repo = {
      listVendors: jest.fn().mockResolvedValue([
        {
          id: 'vendor-1',
          organizationId: 'org-1',
          legalName: 'Pending Vendor',
          categoryCode: 'LESSOR',
          sourceMode: 'Manual',
          createdByActorRef: 'maker',
          submittedByActorRef: 'submitter',
          submittedAtUtc: now,
          createdAtUtc: new Date('2026-07-22T10:00:00Z'),
          updatedAtUtc: now,
        },
      ]),
    };
    const service = new VendorService(
      repo as never,
      {} as never,
      { record: jest.fn() } as never,
      { enqueue: jest.fn() } as never,
      { assertManualWrite: jest.fn() } as never,
    );
    jest.spyOn(service, 'getOnboarding').mockResolvedValue({
      vendor: {} as never,
      profile: { vendorId: 'vendor-1' } as never,
      documentRequirements: [
        {
          code: 'TRADE_LICENCE',
          required: true,
          tracksExpiry: true,
          state: 'Confirmed',
        },
      ],
      completeness: {
        completed: 14,
        required: 14,
        missing: [],
        canSubmit: false,
        canActivate: true,
      },
    });

    await expect(
      service.listApprovalWorkItems(50, 0, 'org-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        vendorId: 'vendor-1',
        makerActorRef: 'maker',
        submitterActorRef: 'submitter',
        assignedAuthorityRole: 'Procurement',
        changeSummary: expect.objectContaining({
          identityUpdated: true,
          termsCaptured: true,
          confirmedDocuments: 1,
        }),
      }),
    ]);
    expect(repo.listVendors).toHaveBeenCalledWith(
      50,
      0,
      'org-1',
      'PendingApproval',
    );
  });

  it('computes onboarding completeness from persisted fields and governed evidence', async () => {
    const repo = {
      findVendorById: jest.fn().mockResolvedValue({
        id: 'vendor-1',
        organizationId: 'org-1',
        legalName: 'Example Vendor',
        categoryCode: 'LESSOR',
        primaryContactName: 'M. Example',
        primaryContactEmail: 'vendor@example.test',
        primaryContactPhone: '+971500000000',
        paymentTerms: 'Net 45',
        sourceMode: 'Manual',
        sourceSystem: null,
        externalRef: null,
        dataQualityFlag: true,
        vendorPortalEnabled: false,
        status: 'Draft',
        tradeName: null,
        tradeLicenceNumber: null,
        tradeLicenceEmirate: null,
        taxRegistrationNumber: null,
        currency: 'AED',
        bankIbanMasked: null,
        primaryContactRole: null,
        notes: null,
        createdAtUtc: new Date('2026-01-01T00:00:00Z'),
        updatedAtUtc: new Date('2026-01-01T00:00:00Z'),
      }),
      findOnboardingProfile: jest.fn().mockResolvedValue({
        vendorId: 'vendor-1',
        standardOffHireNoticeDays: 30,
        earlyTerminationPenalty: 'AED 4,500 per vehicle',
        renewalOptions: '2 x 12 months',
        escalationClause: 'CPI capped at 3%',
        replacementClause: 'Like-for-like within 48h',
        alertLadder: '90/60/30',
        accessMode: 'ManualInternal',
        updatedAtUtc: new Date('2026-01-02T00:00:00Z'),
      }),
      listDocuments: jest.fn().mockResolvedValue([
        {
          documentTypeCode: 'TRADE_LICENCE',
          status: 'Confirmed',
          expiryDate: '2099-12-31',
        },
      ]),
    };
    const lookups = {
      getValueRules: jest.fn().mockResolvedValue([
        {
          code: 'TRADE_LICENCE',
          metadata: { required: true, tracksExpiry: true },
        },
      ]),
    };
    const service = new VendorService(
      repo as never,
      lookups as never,
      { record: jest.fn() } as never,
      { enqueue: jest.fn() } as never,
      { assertManualWrite: jest.fn() } as never,
    );

    await expect(service.getOnboarding('vendor-1', 'org-1')).resolves.toMatchObject({
      documentRequirements: [
        { code: 'TRADE_LICENCE', state: 'Confirmed' },
      ],
      completeness: {
        completed: 14,
        required: 14,
        missing: [],
        canSubmit: true,
        canActivate: true,
      },
    });
  });

  it('blocks activation when a configured required document is missing', async () => {
    const repo = {
      findVendorById: jest.fn().mockResolvedValue({
        id: 'vendor-1',
        organizationId: 'org-1',
        sourceMode: 'Manual',
        status: 'PendingApproval',
        createdByActorRef: 'maker',
        submittedByActorRef: 'maker',
      }),
      currentConfirmedDocument: jest.fn().mockResolvedValue(undefined),
      transaction: jest.fn(),
    };
    const lookups = {
      getValueRules: jest.fn().mockResolvedValue([
        {
          code: 'TRADE_LICENCE',
          metadata: { required: true, tracksExpiry: true },
        },
      ]),
    };
    const source = { assertManualWrite: jest.fn() };
    const service = new VendorService(
      repo as never,
      lookups as never,
      { record: jest.fn() } as never,
      { enqueue: jest.fn() } as never,
      source as never,
    );

    await expect(
      service.transition(
        'vendor-1',
        'Active',
        'VENDOR_APPROVED',
        'procurement-approver',
        undefined,
        true,
        'org-1',
      ),
    ).rejects.toMatchObject({
      response: {
        reasons: [
          VENDOR_REASON.activationEvidenceIncomplete,
          'vendor-required-document-missing:TRADE_LICENCE',
        ],
      },
    });
    expect(repo.transaction).not.toHaveBeenCalled();
  });

  it('rejects and returns no document when outbox enqueue fails', async () => {
    const tx = {};
    const repo = {
      findVendorById: jest.fn().mockResolvedValue({
        id: 'vendor-1',
        organizationId: 'org-1',
        sourceMode: 'Manual',
      }),
      transaction: jest.fn(async (work: (executor: unknown) => unknown) =>
        work(tx),
      ),
      nextDocumentVersion: jest.fn().mockResolvedValue(1),
      insertDocument: jest.fn().mockResolvedValue({
        id: 'document-1',
        organizationId: 'org-1',
        vendorId: 'vendor-1',
        documentTypeCode: 'TRADE_LICENCE',
        version: 1,
        documentReference: null,
        blobRef: 'vendor-documents/vendor-1/trade.pdf',
        issueDate: null,
        expiryDate: null,
        status: 'PendingConfirmation',
        extractedMetadata: null,
        confirmedMetadata: null,
        confirmedByActorRef: null,
        confirmedAtUtc: null,
        supersededById: null,
        createdByActorRef: 'maker',
        createdAtUtc: new Date(),
        updatedAtUtc: new Date(),
      }),
    };
    const lookups = {
      getValues: jest.fn().mockResolvedValue([{ code: 'TRADE_LICENCE' }]),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const outbox = {
      enqueue: jest.fn().mockRejectedValue(new Error('outbox unavailable')),
    };
    const source = { assertManualWrite: jest.fn() };
    const service = new VendorService(
      repo as never,
      lookups as never,
      audit as never,
      outbox as never,
      source as never,
    );

    await expect(
      service.createDocument(
        'vendor-1',
        {
          documentTypeCode: 'TRADE_LICENCE',
          blobRef: 'vendor-documents/vendor-1/trade.pdf',
        },
        'maker',
        'org-1',
      ),
    ).rejects.toThrow('outbox unavailable');
    expect(repo.transaction).toHaveBeenCalledTimes(1);
    expect(repo.insertDocument).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(audit.record).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(outbox.enqueue).toHaveBeenCalledWith(expect.any(Object), tx);
  });
});
