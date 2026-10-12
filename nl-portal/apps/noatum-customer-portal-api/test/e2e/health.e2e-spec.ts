import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../../src/common/tenancy/prisma.service';

/**
 * Smoke test that the module graph actually resolves.
 *
 * Worth more than it looks: most wiring mistakes in a Nest app of this size - a missing
 * export, a circular import, a provider that only exists in one module - show up here
 * rather than in unit tests.
 */
describe('API bootstrap', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves the public health endpoint without a token', async () => {
    await request(app.getHttpServer()).get('/api/me/health').expect(200, { status: 'ok' });
  });

  it('serves uncached public liveness and database readiness', async () => {
    for (const path of ['/api/health', '/api/health/ready']) {
      await request(app.getHttpServer()).get(path)
        .expect('Cache-Control', 'no-store')
        .expect(200, { status: 'ok' });
    }
  });

  it('returns a sanitized 503 on database failure and recovers', async () => {
    const failure = jest.spyOn(app.get(PrismaService), '$transaction')
      .mockRejectedValueOnce(new Error('private database connection details'));
    try {
      const response = await request(app.getHttpServer()).get('/api/health/ready').expect(503);
      expect(response.body.error).toBe('Service unavailable');
      expect(JSON.stringify(response.body)).not.toContain('private database');
      await request(app.getHttpServer()).get('/api/health').expect(200);
    } finally {
      failure.mockRestore();
    }
    await request(app.getHttpServer()).get('/api/health/ready').expect(200);
  });

  it('rejects an authenticated endpoint with no token', async () => {
    await request(app.getHttpServer()).get('/api/me').expect(401);
  });

  it('rejects a bearer token that is not a JWT', async () => {
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });
});
