import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import type { Principal } from '../src/common/auth/principal';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { organization, person } from '../src/common/database/schema';
import { ConsentAdministrationService } from '../src/modules/consent-administration/services/consent-administration.service';

describe('governed consent administration (integration — requires DB)', () => {
  let ctx: INestApplicationContext;
  let db: DrizzleDatabase;
  let service: ConsentAdministrationService;
  const suffix = randomUUID().slice(0, 8);
  const organizationId = randomUUID();
  let stewardId = '';
  let adminId = '';
  const templateIds: string[] = [];

  const principal = (personId: string, role: 'DataSteward' | 'SystemAdmin'): Principal => ({
    organizationId, userId: null, personId, entraObjectId: null, email: null,
    roles: [{ role, scopeNodeId: 'a0000000-0000-4000-8000-000000000001' }], isDevLogin: true,
  });

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    service = ctx.get(ConsentAdministrationService);
    await db.insert(organization).values({ id: organizationId, name: `Consent Test ${suffix}`, code: `CONSENT-${suffix.toUpperCase()}` });
    const people = await db.insert(person).values([
      { organizationId, hcmEmployeeId: `consent-steward-${suffix}`, fullName: `Consent Steward ${suffix}`, employmentStatus: 'Active' },
      { organizationId, hcmEmployeeId: `consent-admin-${suffix}`, fullName: `Consent Admin ${suffix}`, employmentStatus: 'Active' },
    ]).returning({ id: person.id });
    [stewardId, adminId] = people.map(({ id }) => id);
  });

  afterAll(async () => {
    if (templateIds.length) await db.execute(sql`DELETE FROM fleet.consent_template WHERE id IN (${sql.join(templateIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
    if (stewardId && adminId) await db.execute(sql`DELETE FROM fleet.person WHERE id IN (${stewardId}, ${adminId})`);
    await db.execute(sql`DELETE FROM fleet.organization WHERE id = ${organizationId}`);
    await ctx?.close();
  });

  it('activates immutable Booking wording and retires the previous active version', async () => {
    const first = await service.create({
      domain: 'Booking', version: `booking-${suffix}-v1`, effectiveAtUtc: '2026-01-01T00:00:00.000Z',
      content: { en: 'I acknowledge responsibility for this booked fleet vehicle and trip.', ar: 'أقر بمسؤوليتي عن مركبة الأسطول المحجوزة وعن هذه الرحلة.' },
    }, principal(stewardId, 'DataSteward'));
    templateIds.push(first.id);
    const activeFirst = await service.activate(first.id, principal(adminId, 'SystemAdmin'));
    expect(activeFirst.status).toBe('Active');
    expect(await service.current('Booking', organizationId)).toMatchObject({ version: first.version, contentHash: first.contentHash });
    await expect(db.execute(sql`UPDATE fleet.consent_template SET content_en = 'tampered wording' WHERE id = ${first.id}`)).rejects.toMatchObject({ cause: expect.objectContaining({ code: '23514' }) });

    const second = await service.create({
      domain: 'Booking', version: `booking-${suffix}-v2`, effectiveAtUtc: '2026-01-02T00:00:00.000Z',
      content: { en: 'I accept the current fleet booking, custody, safety, and reporting responsibilities.', ar: 'أوافق على مسؤوليات الحجز والعهدة والسلامة والإبلاغ الحالية الخاصة بالأسطول.' },
    }, principal(stewardId, 'DataSteward'));
    templateIds.push(second.id);
    await service.activate(second.id, principal(adminId, 'SystemAdmin'));
    const versions = await service.list(principal(adminId, 'SystemAdmin'), 'Booking');
    expect(versions.find(({ id }) => id === first.id)?.status).toBe('Retired');
    expect(versions.find(({ id }) => id === second.id)?.status).toBe('Active');
    expect((await service.current('Booking', organizationId))?.version).toBe(second.version);
  });

  it('serves and retires Dedicated Vehicle wording through the same registry', async () => {
    const draft = await service.create({
      domain: 'DedicatedVehicle', version: `dedicated-${suffix}-v1`, effectiveAtUtc: '2026-01-01T00:00:00.000Z',
      content: { en: 'I accept assigned-driver custody and reporting responsibilities for this Dedicated Vehicle.', ar: 'أوافق على مسؤوليات عهدة السائق المعيّن والإبلاغ الخاصة بهذه المركبة المخصصة.' },
    }, principal(stewardId, 'DataSteward'));
    templateIds.push(draft.id);
    await service.activate(draft.id, principal(adminId, 'SystemAdmin'));
    expect((await service.current('DedicatedVehicle', organizationId))?.version).toBe(draft.version);
    await service.retire(draft.id, principal(adminId, 'SystemAdmin'));
    expect(await service.current('DedicatedVehicle', organizationId)).toBeNull();
  });

  it('requires a different person to activate authored wording', async () => {
    const draft = await service.create({
      domain: 'Booking', version: `booking-${suffix}-maker`, effectiveAtUtc: '2026-01-01T00:00:00.000Z',
      content: { en: 'I accept this governed Booking wording for maker-checker proof.', ar: 'أوافق على صياغة الحجز المنظمة هذه لإثبات الفصل بين المنشئ والمعتمد.' },
    }, principal(adminId, 'SystemAdmin'));
    templateIds.push(draft.id);
    await expect(service.activate(draft.id, principal(adminId, 'SystemAdmin'))).rejects.toMatchObject({
      response: { reasons: ['consent-template-maker-checker-required'] },
    });
  });
});
