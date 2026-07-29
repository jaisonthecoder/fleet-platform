import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/bootstrap/configure-app';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { person, roleAssignment } from '../src/common/database/schema';

/** Real HTTP proof of Handover authentication, role admission, and command-key guards. */
describe('Handover guarded HTTP (integration — requires DB + Redis)', () => {
  let app: NestFastifyApplication;
  let db: DrizzleDatabase;
  const scopeNodeId = 'a0000000-0000-4000-8000-000000000003';
  const actors = {
    employee: randomUUID(),
    fleet: randomUUID(),
    admin: randomUUID(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get<DrizzleDatabase>(DRIZZLE);
    await db.insert(person).values(Object.entries(actors).map(([label, id]) => ({
      id,
      hcmEmployeeId: `handover-http-${label}-${id}`,
      fullName: `Handover ${label}`,
      employmentStatus: 'Active',
    })));
    await db.insert(roleAssignment).values([
      { personId: actors.employee, role: 'Employee', scopeNodeId },
      { personId: actors.fleet, role: 'FleetManager', scopeNodeId },
      { personId: actors.admin, role: 'SystemAdmin', scopeNodeId },
    ]);
  });

  afterAll(async () => {
    for (const personId of Object.values(actors)) {
      await db.delete(roleAssignment).where(eq(roleAssignment.personId, personId));
      await db.delete(person).where(eq(person.id, personId));
    }
    await app.close();
  });

  it('admits only Fleet roles to the custody register', async () => {
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/v1/handovers' });
    expect(unauthenticated.statusCode).toBe(401);

    for (const personId of [actors.employee, actors.admin]) {
      const denied = await app.inject({ method: 'GET', url: '/api/v1/handovers', headers: { 'x-dev-person-id': personId } });
      expect(denied.statusCode).toBe(403);
    }

    const fleet = await app.inject({ method: 'GET', url: '/api/v1/handovers', headers: { 'x-dev-person-id': actors.fleet } });
    expect(fleet.statusCode).toBe(200);
    expect(fleet.json()).toEqual(expect.any(Array));
  });

  it('rejects open commands without a durable Idempotency-Key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/handovers',
      headers: { 'x-dev-person-id': actors.fleet },
      payload: {
        bookingId: randomUUID(),
        employeePersonId: randomUUID(),
        startOdometer: 1000,
        startFuelEighths: 8,
        signatureRef: 'test-signature',
        checklist: [],
        offlineCaptured: false,
        existingDamage: [],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ reasons: ['handover-idempotency-key-required'] });
  });
});
