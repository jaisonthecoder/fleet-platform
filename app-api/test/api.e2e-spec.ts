import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/bootstrap/configure-app';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { person, roleAssignment } from '../src/common/database/schema';
import { operationsOverviewSchema } from '../src/contracts/operations-overview.contract';

describe('API health (e2e)', () => {
  let app: NestFastifyApplication;
  let db: DrizzleDatabase;
  const personId = randomUUID();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get<DrizzleDatabase>(DRIZZLE);
    await db.insert(person).values({
      id: personId,
      hcmEmployeeId: `e2e-${personId}`,
      fullName: 'E2E Authenticated User',
      employmentStatus: 'Active',
    });
    await db.insert(roleAssignment).values({
      personId,
      role: 'Employee',
      scopeNodeId: 'a0000000-0000-4000-8000-000000000003',
    });
  });

  afterAll(async () => {
    await db.delete(roleAssignment).where(eq(roleAssignment.personId, personId));
    await db.delete(person).where(eq(person.id, personId));
    await app.close();
  });

  it('GET /health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'api' });
  });

  it('GET /api/v1/operations/overview is protected — 401 without authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/operations/overview?scopeId=a0000000-0000-4000-8000-000000000003',
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/v1/operations/overview returns the typed read model when authenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/operations/overview?scopeId=a0000000-0000-4000-8000-000000000003',
      headers: { 'x-dev-person-id': personId },
    });

    expect(response.statusCode).toBe(200);
    expect(operationsOverviewSchema.safeParse(response.json()).success).toBe(
      true,
    );
  });

  it('GET /api/v1/hierarchy is protected — 401 without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/hierarchy' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/access-review is protected — 401 without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/access-review' });
    expect(response.statusCode).toBe(401);
  });
});
