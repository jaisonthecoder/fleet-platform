import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FeatureSwitchService } from '../../src/common/features/feature-switch.service';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext, type TenantContextData } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { PERMISSIONS } from '../../src/contracts/permissions';
import { LocalDiskStorageAdapter } from '../../src/integration/storage/local-disk-storage.adapter';
import { AttachmentsService } from '../../src/modules/documents/attachments.service';
import { FileValidationService } from '../../src/modules/documents/file-validation.service';
import { analyticsFor } from '../fixtures/analytics.fixture';

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25]);

/**
 * Attachments against a real database.
 *
 * The tests that matter are not "can a file be stored". They are: can one
 * customer reach another's document, does a document held back from a customer
 * actually disappear from their surfaces, and does a refusal ever reveal that a
 * file exists.
 */
describe('quote documents', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let context: TenantContext;
  let repository: TenantRepository;
  let service: AttachmentsService;
  let storageRoot: string;

  let groupA: string;
  let groupB: string;
  let userA: string;
  let userB: string;
  let staffId: string;

  const customer = (groupId: string, userId: string): TenantContextData => ({
    customerGroupId: groupId,
    userId,
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>([
      PERMISSIONS.QUOTES_READ,
      PERMISSIONS.DOCUMENTS_UPLOAD,
      PERMISSIONS.DOCUMENTS_DOWNLOAD,
    ]),
    correlationId: 'doc-customer',
  });

  const staff = (): TenantContextData => ({
    customerGroupId: null,
    userId: staffId,
    isInternal: true,
    accountIds: [],
    permissions: new Set<string>([
      PERMISSIONS.DOCUMENTS_UPLOAD,
      PERMISSIONS.DOCUMENTS_DOWNLOAD,
      PERMISSIONS.PRICING_QUEUE_READ,
    ]),
    correlationId: 'doc-staff',
  });

  const file = (name = 'packing-list.pdf') => ({
    originalname: name,
    mimetype: 'application/pdf',
    size: PDF.length,
    buffer: PDF,
  });

  const makeQuote = async (groupId: string) => {
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupId,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested',
        mode: 'sea',
        originCode: 'CNSHA',
        destinationCode: 'ESVLC',
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    return quote.id;
  };

  const setSwitch = async (key: string, isEnabled: boolean) => {
    await owner.featureSwitch.upsert({
      where: { key },
      create: { key, isEnabled, reason: 'isolation test' },
      update: { isEnabled },
    });
  };

  beforeAll(async () => {
    owner = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_MIGRATION_URL,
        connectionTimeoutMillis: 5000,
      }),
    });
    await owner.$connect();

    storageRoot = await mkdtemp(join(tmpdir(), 'noatum-docs-'));

    context = new TenantContext();
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new TenantRepository(prisma, context);

    const config = new ConfigService({
      storage: {
        driver: 'local',
        localRoot: storageRoot,
        container: 'test-documents',
        maxUploadBytes: 1024 * 1024,
      },
    });

    service = new AttachmentsService(
      repository,
      context,
      new LocalDiskStorageAdapter(config),
      new FileValidationService(),
      new FeatureSwitchService(prisma),
      analyticsFor(repository, context),
      config,
    );

    const groups = await Promise.all([
      owner.customerGroup.create({
        data: { name: `Docs A ${randomUUID().slice(0, 6)}`, slug: `docs-a-${randomUUID().slice(0, 8)}`, status: 'active', updatedAt: new Date() },
        select: { id: true },
      }),
      owner.customerGroup.create({
        data: { name: `Docs B ${randomUUID().slice(0, 6)}`, slug: `docs-b-${randomUUID().slice(0, 8)}`, status: 'active', updatedAt: new Date() },
        select: { id: true },
      }),
    ]);
    groupA = groups[0].id;
    groupB = groups[1].id;

    const users = await Promise.all([
      owner.user.create({
        data: { email: `a-${randomUUID()}@test.example`, displayName: 'Customer A', customerGroupId: groupA, status: 'active', updatedAt: new Date() },
        select: { id: true },
      }),
      owner.user.create({
        data: { email: `b-${randomUUID()}@test.example`, displayName: 'Customer B', customerGroupId: groupB, status: 'active', updatedAt: new Date() },
        select: { id: true },
      }),
      owner.user.create({
        data: { email: `s-${randomUUID()}@test.example`, displayName: 'Pricer', isInternal: true, status: 'active', updatedAt: new Date() },
        select: { id: true },
      }),
    ]);
    userA = users[0].id;
    userB = users[1].id;
    staffId = users[2].id;

    await setSwitch('documents.customer_upload', true);
    await setSwitch('documents.quote_answer', true);
  });

  afterAll(async () => {
    await owner.featureSwitch.deleteMany({
      where: { key: { in: ['documents.customer_upload', 'documents.quote_answer'] } },
    });
    await owner.quote.deleteMany({ where: { customerGroupId: { in: [groupA, groupB] } } });
    await owner.storedFile.deleteMany({ where: { uploadedByUserId: { in: [userA, userB, staffId] } } });
    await owner.user.deleteMany({ where: { id: { in: [userA, userB, staffId] } } });
    await owner.customerGroup.deleteMany({ where: { id: { in: [groupA, groupB] } } });
    await prisma.$disconnect();
    await owner.$disconnect();
    await rm(storageRoot, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Tenancy
  // -------------------------------------------------------------------------

  it('keeps one customer out of another customer document list', async () => {
    const quote = await makeQuote(groupA);
    await context.run(customer(groupA, userA), () =>
      service.upload(quote, { documentType: 'packing_list', direction: 'from_customer' }, file()),
    );

    const seen = await context.run(customer(groupB, userB), () => service.listForCustomer(quote));

    expect(seen).toHaveLength(0);
  });

  it('refuses to attach to another customer quote, and says only that it is not found', async () => {
    const quote = await makeQuote(groupA);

    await expect(
      context.run(customer(groupB, userB), () =>
        service.upload(quote, { documentType: 'packing_list', direction: 'from_customer' }, file()),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gives the same answer for a foreign document as for one that never existed', async () => {
    const quote = await makeQuote(groupA);
    const document = await context.run(customer(groupA, userA), () =>
      service.upload(quote, { documentType: 'packing_list', direction: 'from_customer' }, file()),
    );

    // A different status, or a different message, would confirm that somebody
    // else's document is there.
    const foreign = context.run(customer(groupB, userB), () => service.download(document.id));
    const absent = context.run(customer(groupB, userB), () =>
      service.download('33333333-3333-4333-8333-333333333333'),
    );

    await expect(foreign).rejects.toBeInstanceOf(NotFoundException);
    await expect(absent).rejects.toBeInstanceOf(NotFoundException);
  });

  // -------------------------------------------------------------------------
  // Absent, not hidden
  // -------------------------------------------------------------------------

  it('leaves a held-back answer out of the customer list entirely', async () => {
    const quote = await makeQuote(groupA);

    await context.run(staff(), () =>
      service.upload(
        quote,
        { documentType: 'quotation', direction: 'to_customer', customerVisible: false },
        file('draft-quote.pdf'),
      ),
    );

    const customerView = await context.run(customer(groupA, userA), () =>
      service.listForCustomer(quote),
    );
    const staffView = await context.run(staff(), () => service.listForStaff(quote));

    expect(customerView).toHaveLength(0);
    expect(staffView).toHaveLength(1);
    expect(staffView[0]?.customerVisible).toBe(false);
  });

  it('refuses the customer the bytes of a held-back document', async () => {
    const quote = await makeQuote(groupA);
    const document = await context.run(staff(), () =>
      service.upload(
        quote,
        { documentType: 'quotation', direction: 'to_customer', customerVisible: false },
        file('internal.pdf'),
      ),
    );

    await expect(
      context.run(customer(groupA, userA), () => service.download(document.id)),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Staff can still read it, so the refusal is about visibility and not a
    // broken record.
    await expect(context.run(staff(), () => service.download(document.id))).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Direction
  // -------------------------------------------------------------------------

  it('refuses a customer attaching something that would look like our answer', async () => {
    const quote = await makeQuote(groupA);

    await expect(
      context.run(customer(groupA, userA), () =>
        service.upload(quote, { documentType: 'quotation', direction: 'to_customer' }, file()),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a document type that does not belong to its direction', async () => {
    const quote = await makeQuote(groupA);

    await expect(
      context.run(customer(groupA, userA), () =>
        service.upload(quote, { documentType: 'quotation', direction: 'from_customer' }, file()),
      ),
    ).rejects.toBeDefined();
  });

  it('always shows a customer their own upload', async () => {
    const quote = await makeQuote(groupA);

    // `customerVisible: false` is meaningless on an upload the customer made;
    // hiding someone's own paperwork from them would be absurd.
    await context.run(customer(groupA, userA), () =>
      service.upload(
        quote,
        { documentType: 'packing_list', direction: 'from_customer', customerVisible: false },
        file(),
      ),
    );

    const seen = await context.run(customer(groupA, userA), () => service.listForCustomer(quote));

    expect(seen).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // The switch
  // -------------------------------------------------------------------------

  it('refuses a customer upload when the switch is off', async () => {
    await setSwitch('documents.customer_upload', false);
    const quote = await makeQuote(groupA);

    await expect(
      context.run(customer(groupA, userA), () =>
        service.upload(quote, { documentType: 'packing_list', direction: 'from_customer' }, file()),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await setSwitch('documents.customer_upload', true);
  });

  // -------------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------------

  it('stores the bytes and returns them unchanged', async () => {
    const quote = await makeQuote(groupA);
    const document = await context.run(customer(groupA, userA), () =>
      service.upload(quote, { documentType: 'packing_list', direction: 'from_customer' }, file()),
    );

    const downloaded = await context.run(customer(groupA, userA), () =>
      service.download(document.id),
    );

    expect(downloaded.content.equals(PDF)).toBe(true);
    expect(downloaded.filename).toBe('packing-list.pdf');
  });

  it('never puts the customer filename in the stored object name', async () => {
    const quote = await makeQuote(groupA);
    const document = await context.run(customer(groupA, userA), () =>
      service.upload(
        quote,
        { documentType: 'packing_list', direction: 'from_customer' },
        file('../../escape.pdf'),
      ),
    );

    const stored = await owner.quoteDocument.findUniqueOrThrow({
      where: { id: document.id },
      select: { file: { select: { blobName: true, originalFilename: true } } },
    });

    expect(stored.file.blobName).not.toContain('escape');
    expect(stored.file.blobName).not.toContain('..');
    // The name survives for display, with the path stripped out of it.
    expect(stored.file.originalFilename).not.toContain('/');
  });

  it('removes the object when the document is removed', async () => {
    const quote = await makeQuote(groupA);
    const document = await context.run(staff(), () =>
      service.upload(quote, { documentType: 'quotation', direction: 'to_customer' }, file('gone.pdf')),
    );

    await context.run(staff(), () => service.remove(document.id));

    expect(await owner.quoteDocument.count({ where: { id: document.id } })).toBe(0);
    await expect(
      context.run(staff(), () => service.download(document.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
