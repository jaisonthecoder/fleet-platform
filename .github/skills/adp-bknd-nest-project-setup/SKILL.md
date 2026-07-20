---
name: adp-bknd-nest-project-setup
description: "End-to-end initial setup for a production-grade NestJS + TypeScript service (Fastify, SWC, Zod config, pino logging, global validation + RFC-7807 errors, Terminus health, Swagger, optional Postgres/Redis, Jest/Supertest, dependency-cruiser, Docker, CI) plus per-environment .env files. Business-agnostic starter — no domain modules. Use when scaffolding a new NestJS backend or bringing an empty one up to a complete, verifiable baseline. Owned by AI Backend Engineer (NestJS)."
---

# adp-bknd-nest-project-setup

A copy-paste, end-to-end guide to stand up a **production-grade NestJS service** from zero to a green build. It is deliberately **business-agnostic**: it wires the framework, configuration, cross-cutting concerns, per-environment config files, testing, containerisation and CI — but contains **no domain/feature modules**. Add those afterwards using the module layout in §6.

All versions in this document are the **latest available** at authoring time (see the version table in §21). Pin them, then bump deliberately.

---

## Intake — ask the user before scaffolding

**Do not guess on choices that change the generated tree.** If the answer is unknown and material, ask the user; otherwise apply the documented default. Ask these up front (batch them in one question round):

| # | Question | Default if unanswered |
|---|---|---|
| 1 | Service name and repo layout — standalone repo, or a package inside an existing pnpm workspace? | standalone, `my-service` |
| 2 | Package manager — pnpm or npm? | pnpm |
| 3 | Primary datastore — PostgreSQL, none, or other (SQL Server / MySQL / Mongo)? | PostgreSQL (Drizzle) |
| 4 | ORM/driver — Drizzle, Prisma, TypeORM, or none? | Drizzle |
| 5 | Cache/queue — Redis? BullMQ jobs? | Redis yes, BullMQ no |
| 6 | Validation stack — Zod (`nestjs-zod`) or class-validator? | Zod |
| 7 | Linter — oxlint or ESLint? | oxlint |
| 8 | Auth / identity provider — Entra ID (OIDC/JWT), other, or none for now? | none (add later) |
| 9 | Cloud target — Azure, AWS, GCP, none — which drives the optional integration env keys and region? | none (core keys only) |
| 10 | Which environments to generate — `.env.local`, `.env.uat`, `.env.prod`, others (dev/staging)? | local, uat, prod |
| 11 | Node version / any data-residency or compliance constraint? | Node 24 |

Then confirm the resulting stack back to the user in one line before writing files. Drop any optional module (§11 DB, §12 Redis) and its env keys the user does not need — keep the scaffold minimal and green.

---

## 0. What you get

- **NestJS 11 on Fastify** compiled with **SWC** (fast builds) with `tsc --noEmit` as the strict type gate.
- **Typed, validated configuration** (Zod + `@nestjs/config`), concern-split, with `.env` files per environment.
- **Structured logging** (pino) with correlation ids and header redaction.
- **Global validation** (`nestjs-zod`) and **RFC-7807 problem-details** error responses.
- **Health probes** (Terminus liveness + readiness).
- **OpenAPI/Swagger** in non-production.
- **Security headers** (`@fastify/helmet`) + CORS + global prefix + URI versioning.
- **Optional infra**: PostgreSQL (Drizzle) and Redis (ioredis) modules, lazy-connecting.
- **Tests**: Jest + SWC (unit) and Supertest (e2e) with a shared app-configuration helper.
- **Quality gates**: oxlint, Prettier, dependency-cruiser module boundaries.
- **Local infra** (`docker compose`) and **multi-stage Dockerfile**.
- **CI** (GitHub Actions).

---

## 1. Prerequisites & toolchain

| Tool | Version | Notes |
|---|---|---|
| Node.js | **>= 24** | LTS. Pin in `.nvmrc`. |
| pnpm | **>= 11** | Recommended package manager (workspace + catalog support). `npm` works too. |
| Docker | latest | For local Postgres/Redis. |

```bash
node -v            # v24+
corepack enable    # or install pnpm globally: npm i -g pnpm
echo "24" > .nvmrc
```

> Throughout this guide commands use `pnpm`. For `npm`, replace `pnpm add` → `npm i`, `pnpm add -D` → `npm i -D`, and `pnpm <script>` → `npm run <script>`.

---

## 2. Initialise the project

Greenfield, without the Nest CLI generator (keeps the tree minimal and under your control):

```bash
mkdir my-service && cd my-service
pnpm init
echo "24" > .nvmrc
git init
```

Set the package metadata in `package.json`:

```jsonc
{
  "name": "my-service",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@11.13.1",
  "engines": { "node": ">=24", "pnpm": ">=11" }
}
```

---

## 3. Install dependencies (latest)

**Runtime:**

```bash
pnpm add @nestjs/common@^11.1.28 @nestjs/core@^11.1.28 @nestjs/platform-fastify@^11.1.28 \
  fastify@^5.10.0 @fastify/helmet@^13.1.0 \
  @nestjs/config@^4.0.4 @nestjs/swagger@^11.4.5 @nestjs/terminus@^11.1.1 \
  nestjs-zod@^5.4.0 zod@^4.4.3 \
  nestjs-pino@^4.6.1 pino@^10.3.1 pino-http@^11.0.0 \
  reflect-metadata@^0.2.2 rxjs@^7.8.2
```

**Optional infra** (include only what you need):

```bash
# PostgreSQL via Drizzle
pnpm add drizzle-orm@^0.45.2 postgres@^3.4.9
pnpm add -D drizzle-kit@^0.31.10 dotenv@^17.4.2
# Redis
pnpm add ioredis@^5.11.1
```

**Dev / tooling:**

```bash
pnpm add -D typescript@^7.0.2 @types/node@^26.1.1 \
  @swc/core@^1.15.43 @swc/cli@^0.8.1 @swc/jest@^0.2.39 \
  jest@^30.4.2 @types/jest@^30.0.0 supertest@^7.2.2 @types/supertest@^7.2.1 \
  @nestjs/testing@^11.1.28 \
  oxlint@^1.74.0 prettier@^3.9.5 \
  dependency-cruiser@^18.1.0 pino-pretty@^13.1.3 \
  source-map-support@^0.5.21
```

> **Linter choice:** this guide uses **oxlint** (Rust-based, extremely fast, zero-config). If your org standardises on ESLint, swap it for `eslint` + `typescript-eslint` + `eslint-config-prettier` and adjust the `lint` script.

---

## 4. TypeScript + SWC configuration

`tsconfig.json` (strict; used by the `tsc --noEmit` type gate and by editors):

```jsonc
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2023",
    "moduleResolution": "node",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node", "jest"],
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`tsconfig.build.json`:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "./src" },
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

`.swcrc` (SWC compiles source; it does **not** type-check — that's `tsc --noEmit`'s job):

```json
{
  "$schema": "https://swc.rs/schema.json",
  "sourceMaps": true,
  "jsc": {
    "parser": { "syntax": "typescript", "decorators": true },
    "transform": { "legacyDecorator": true, "decoratorMetadata": true },
    "target": "es2023",
    "keepClassNames": true
  },
  "module": { "type": "commonjs", "strict": true, "noInterop": false }
}
```

---

## 5. Project structure (module-boundary standard)

```text
src/
  main.ts                      # bootstrap
  app.module.ts                # root module
  common/                      # cross-cutting, non-feature code
    bootstrap/
      configure-app.ts         # shared prefix/versioning/shutdown (main.ts + e2e)
    config/
      config.schema.ts         # Zod env schema + validateEnv()
      app.config.ts            # registerAs('app', ...)
      database.config.ts
      redis.config.ts
      logging.config.ts
      observability.config.ts
      openapi.config.ts
      config.module.ts         # global ConfigModule wrapper
      index.ts                 # barrel + `configurations` array
    database/                  # optional infra module
      database.constants.ts
      database.module.ts
      schema.ts
    redis/                     # optional infra module
      redis.constants.ts
      redis.module.ts
    filters/
      problem-details.filter.ts
    logging/
      logging.module.ts
    openapi/
      swagger.ts
    observability/
      instrumentation.ts       # optional (OpenTelemetry)
  modules/
    health/                    # the one bundled feature module
      health.module.ts
      controllers/
        health.controller.ts
        readiness.controller.ts
      services/
        health.service.ts
        database.health.ts
        redis.health.ts
test/
  app.e2e-spec.ts
  jest-e2e.json
```

Repository-root files created by this guide:

```text
.nvmrc  package.json  pnpm-lock.yaml
tsconfig.json  tsconfig.build.json  .swcrc
.prettierrc  .oxlintrc.json  .dependency-cruiser.cjs
.gitignore  .dockerignore  Dockerfile  docker-compose.yml
drizzle.config.ts               # if using Drizzle
.env.example                    # committed
.env.local  .env.uat  .env.prod # gitignored, dummy values
.github/workflows/ci.yml
```

**Feature-module layout (apply to every module you add later).** Subfolders are mandatory from the first file; the module root holds only `<feature>.module.ts`:

```text
src/modules/<feature>/
  controllers/   services/   dto/   entities/   repositories/
  guards/  interceptors/  pipes/  decorators/  interfaces/  enums/  constants/
  <feature>.module.ts
```

Rules: controllers do HTTP only (no business rules, no data access); services hold use cases; repositories hide the datastore; DTOs are never ORM entities (use `.request.dto.ts` / `.response.dto.ts`); a feature never imports another feature's internals — depend on an exported service/interface. Config lives under `src/common/config/`, never inline in `main.ts`.

---

## 6. Environment configuration (typed + validated)

`src/common/config/config.schema.ts`:

```ts
import { z } from 'zod';

export const NODE_ENVS = ['local', 'development', 'test', 'uat', 'production'] as const;

/** Parses truthy env strings ("1"/"true"/"yes"/"on") into booleans. */
const boolFromEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
  }, z.boolean());

/** Single source of truth for env vars. Infra values default so boot never fails locally/in tests. */
export const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default('local'),
  PORT: z.coerce.number().int().positive().default(3000),
  GLOBAL_PREFIX: z.string().default('api'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: boolFromEnv(false),

  DATABASE_URL: z.string().default('postgres://app:app@localhost:5432/app'),
  DATABASE_SSL: boolFromEnv(false),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_TLS: boolFromEnv(false),

  OTEL_ENABLED: boolFromEnv(false),
  OTEL_SERVICE_NAME: z.string().default('my-service'),

  SWAGGER_ENABLED: boolFromEnv(true),
  SWAGGER_PATH: z.string().default('api-docs'),
});

export type Env = z.infer<typeof envSchema>;

/** Validates raw env, throwing one readable error listing every invalid key. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
```

Namespaced config factories (one per concern). Example `src/common/config/app.config.ts`:

```ts
import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

/** Application-wide runtime configuration. */
export const appConfig = registerAs('app', () => {
  const env = validateEnv(process.env);
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    globalPrefix: env.GLOBAL_PREFIX,
    corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  };
});
```

`database.config.ts`, `redis.config.ts`, `logging.config.ts`, `observability.config.ts`, `openapi.config.ts` follow the same `registerAs('<name>', () => { const env = validateEnv(process.env); return {...}; })` pattern. Example `openapi.config.ts`:

```ts
import { registerAs } from '@nestjs/config';
import { validateEnv } from './config.schema';

export const openapiConfig = registerAs('openapi', () => {
  const env = validateEnv(process.env);
  return {
    enabled: env.SWAGGER_ENABLED && env.NODE_ENV !== 'production',
    path: env.SWAGGER_PATH,
    title: 'My Service API',
    description: 'Service API documentation.',
    version: 'v1',
  };
});
```

`src/common/config/index.ts`:

```ts
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { redisConfig } from './redis.config';
import { loggingConfig } from './logging.config';
import { observabilityConfig } from './observability.config';
import { openapiConfig } from './openapi.config';

export * from './config.schema';
export { appConfig, databaseConfig, redisConfig, loggingConfig, observabilityConfig, openapiConfig };

/** Every namespaced factory, loaded by ConfigModule. */
export const configurations = [
  appConfig, databaseConfig, redisConfig, loggingConfig, observabilityConfig, openapiConfig,
];
```

`src/common/config/config.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configurations } from './index';
import { validateEnv } from './config.schema';

const nodeEnv = process.env.NODE_ENV ?? 'local';

/** Loads, validates and exposes env config process-wide. Precedence: .env.<NODE_ENV> > .env.local > .env */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [`.env.${nodeEnv}`, '.env.local', '.env'],
      load: configurations,
      validate: validateEnv,
    }),
  ],
})
export class CoreConfigModule {}
```

Inject config anywhere with the namespaced token:

```ts
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../common/config/app.config';
// constructor(@Inject(appConfig.KEY) private readonly cfg: ConfigType<typeof appConfig>) {}
```

**Environment files (create all of them).** Mirror the layout used across environments: one committed template plus one dummy-valued file per environment. `ConfigModule` loads them in the precedence `.env.<NODE_ENV>` > `.env.local` > `.env`.

| File | Committed? | Purpose |
|---|---|---|
| `.env.example` | ✅ yes | Documented template of every key. The reference contract. |
| `.env.local` | ❌ no (gitignored) | Local dev — points at docker-compose infra; pretty debug logs. |
| `.env.uat` | ❌ no (gitignored) | UAT — dummy cloud endpoints; secrets replaced by the pipeline. |
| `.env.prod` | ❌ no (gitignored) | Production — real values injected from the secret store at deploy; this file only documents required keys. |

`.gitignore` (keeps real values out of git, commits only the template):

```gitignore
/dist
/node_modules
/coverage
*.tsbuildinfo
.env
.env.*
!.env.example
```

`.env.example` — the committed contract. The **core** block is always present; keep the **optional cloud** block only for the integrations the user confirmed in intake (add matching keys to `config.schema.ts`). Never commit real secrets here.

```dotenv
# ── Core ─────────────────────────────────────────────────────────────
NODE_ENV=local
PORT=3000
GLOBAL_PREFIX=api
CORS_ORIGINS=http://localhost:5173

# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# PostgreSQL
DATABASE_URL=postgres://app:app@localhost:5432/app
DATABASE_SSL=false
DATABASE_MAX_CONNECTIONS=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_TLS=false

# Observability (OpenTelemetry)
OTEL_ENABLED=false
OTEL_SERVICE_NAME=my-service

# OpenAPI / Swagger (served in non-production)
SWAGGER_ENABLED=true
SWAGGER_PATH=api-docs

# ── Optional cloud integrations (keep only what you use) ─────────────
# Auth / OIDC (e.g. Microsoft Entra ID)
# AUTH_ISSUER=
# AUTH_AUDIENCE=
# AUTH_CLIENT_ID=
# AUTH_TENANT_ID=
# Object storage
# STORAGE_CONNECTION_STRING=
# Message bus / events
# MESSAGE_BUS_CONNECTION_STRING=
# Secret store
# KEY_VAULT_URI=
```

`.env.local` — local development (targets the §16 docker-compose):

```dotenv
NODE_ENV=local
PORT=3000
GLOBAL_PREFIX=api
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=debug
LOG_PRETTY=true
DATABASE_URL=postgres://app:app@localhost:5432/app
DATABASE_SSL=false
DATABASE_MAX_CONNECTIONS=10
REDIS_URL=redis://localhost:6379
REDIS_TLS=false
OTEL_ENABLED=false
OTEL_SERVICE_NAME=my-service-local
SWAGGER_ENABLED=true
SWAGGER_PATH=api-docs
```

`.env.uat` — UAT with dummy cloud values (`CHANGE_ME` = injected by the pipeline from the secret store):

```dotenv
NODE_ENV=uat
PORT=3000
GLOBAL_PREFIX=api
CORS_ORIGINS=https://my-service-uat.example
LOG_LEVEL=info
LOG_PRETTY=false
DATABASE_URL=postgres://app_uat:CHANGE_ME@my-service-uat-psql.example:5432/app?sslmode=require
DATABASE_SSL=true
DATABASE_MAX_CONNECTIONS=20
REDIS_URL=rediss://my-service-uat-redis.example:6380
REDIS_TLS=true
OTEL_ENABLED=true
OTEL_SERVICE_NAME=my-service-uat
SWAGGER_ENABLED=true
SWAGGER_PATH=api-docs
# Optional cloud (uncomment the ones you kept in .env.example)
# AUTH_ISSUER=https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0
# AUTH_AUDIENCE=api://my-service-uat
# AUTH_CLIENT_ID=22222222-2222-2222-2222-222222222222
# AUTH_TENANT_ID=11111111-1111-1111-1111-111111111111
# KEY_VAULT_URI=https://my-service-uat-kv.vault.azure.net/
```

`.env.prod` — production; real values come from the secret store via managed identity, this file documents the required keys:

```dotenv
NODE_ENV=production
PORT=3000
GLOBAL_PREFIX=api
CORS_ORIGINS=https://my-service.example
LOG_LEVEL=info
LOG_PRETTY=false
DATABASE_URL=postgres://app_prod:FROM_SECRET_STORE@my-service-prod-psql.example:5432/app?sslmode=require
DATABASE_SSL=true
DATABASE_MAX_CONNECTIONS=40
REDIS_URL=rediss://my-service-prod-redis.example:6380
REDIS_TLS=true
OTEL_ENABLED=true
OTEL_SERVICE_NAME=my-service
SWAGGER_ENABLED=false
SWAGGER_PATH=api-docs
# Optional cloud
# AUTH_ISSUER=https://login.microsoftonline.com/44444444-4444-4444-4444-444444444444/v2.0
# AUTH_AUDIENCE=api://my-service
# AUTH_CLIENT_ID=55555555-5555-5555-5555-555555555555
# AUTH_TENANT_ID=44444444-4444-4444-4444-444444444444
# KEY_VAULT_URI=https://my-service-prod-kv.vault.azure.net/
```

> Every key that appears in an env file must exist in `config.schema.ts` (optional/defaulted) or `validateEnv` will reject boot. Add the optional-cloud keys you keep, and delete DB/Redis keys if you skipped those modules.

---

## 7. Cross-cutting building blocks

### 7.1 Logging (`src/common/logging/logging.module.ts`)

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { LoggerModule } from 'nestjs-pino';
import { loggingConfig } from '../config/logging.config';

/** Global structured logging (pino) with correlation id + header redaction. */
@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [loggingConfig.KEY],
      useFactory: (config: ConfigType<typeof loggingConfig>) => ({
        pinoHttp: {
          level: config.level,
          name: config.serviceName,
          genReqId: (req: IncomingMessage): string => {
            const header = req.headers['x-correlation-id'];
            return (Array.isArray(header) ? header[0] : header) ?? randomUUID();
          },
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
            remove: true,
          },
          transport: config.pretty ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        },
      }),
    }),
  ],
})
export class LoggingModule {}
```

`logging.config.ts` returns `{ level: env.LOG_LEVEL, pretty: env.LOG_PRETTY, serviceName: env.OTEL_SERVICE_NAME }`.

### 7.2 RFC-7807 exception filter (`src/common/filters/problem-details.filter.ts`)

```ts
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface ProblemDetails { type: string; title: string; status: number; detail?: string; reasons?: string[]; instance?: string; }

/** Serialises every error to application/problem+json (RFC-7807). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const problem = this.toProblem(exception, status, request.url);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${request.method} ${request.url} -> ${status}`, exception instanceof Error ? exception.stack : String(exception));
    }
    void reply.status(status).header('content-type', 'application/problem+json').send(problem);
  }

  private toProblem(exception: unknown, status: number, instance: string): ProblemDetails {
    const problem: ProblemDetails = { type: 'about:blank', title: HttpStatus[status] ?? 'Error', status, instance };
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') problem.detail = response;
      else if (response && typeof response === 'object') {
        const body = response as Record<string, unknown>;
        if (typeof body.title === 'string') problem.title = body.title;
        if (Array.isArray(body.reasons)) problem.reasons = body.reasons.map(String);
        const message = body.message;
        if (typeof message === 'string') problem.detail = message;
        else if (Array.isArray(message)) problem.reasons = [...(problem.reasons ?? []), ...message.map(String)];
      }
    }
    return problem;
  }
}
```

### 7.3 OpenAPI (`src/common/openapi/swagger.ts`)

```ts
import type { INestApplication } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { openapiConfig } from '../config/openapi.config';

/** Mounts Swagger UI when enabled (non-production). */
export function setupSwagger(app: INestApplication, config: ConfigType<typeof openapiConfig>): void {
  if (!config.enabled) return;
  const document = new DocumentBuilder()
    .setTitle(config.title).setDescription(config.description).setVersion(config.version)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();
  SwaggerModule.setup(config.path, app, SwaggerModule.createDocument(app, document), {
    swaggerOptions: { persistAuthorization: true },
  });
}
```

### 7.4 Shared app configuration (`src/common/bootstrap/configure-app.ts`)

Keeps routing identical between `main.ts` and the e2e harness:

```ts
import { type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from '../config/app.config';

/** Global `/api` prefix (health excluded) + URI versioning (`/api/v1/...`). */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  app.setGlobalPrefix(config.globalPrefix, { exclude: ['health', 'health/ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
}
```

---

## 8. Bootstrap (`src/main.ts`)

```ts
import helmet from '@fastify/helmet';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap/configure-app';
import { appConfig } from './common/config/app.config';
import { openapiConfig } from './common/config/openapi.config';
import { setupSwagger } from './common/openapi/swagger';

/** Boots the HTTP service. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.register(helmet, { contentSecurityPolicy: config.isProduction ? undefined : false });
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  configureApp(app);
  setupSwagger(app, app.get<ConfigType<typeof openapiConfig>>(openapiConfig.KEY));

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
```

## 9. Root module (`src/app.module.ts`)

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { CoreConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { LoggingModule } from './common/logging/logging.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    CoreConfigModule,
    LoggingModule,
    DatabaseModule, // optional
    RedisModule,    // optional
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
```

> The global `ZodValidationPipe` validates any DTO created with `createZodDto(...)`; plain params pass through untouched. Define request DTOs like `export class CreateThingDto extends createZodDto(createThingSchema) {}`.

---

## 10. Health checks (`src/modules/health/`)

`services/health.service.ts` (liveness):

```ts
import { Injectable } from '@nestjs/common';

export interface HealthStatus { status: 'ok'; service: string; timestamp: string; }

@Injectable()
export class HealthService {
  /** Lightweight liveness payload for container probes. */
  getStatus(service: string): HealthStatus {
    return { status: 'ok', service, timestamp: new Date().toISOString() };
  }
}
```

`controllers/health.controller.ts` (unversioned, unprefixed):

```ts
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthService, HealthStatus } from '../services/health.service';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}
  /** Liveness. */
  @Get() get(): HealthStatus { return this.health.getStatus('my-service'); }
}
```

`controllers/readiness.controller.ts` (deep readiness via Terminus):

```ts
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '../services/database.health';
import { RedisHealthIndicator } from '../services/redis.health';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class ReadinessController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}
  /** Readiness: verifies downstream dependencies. */
  @Get('ready')
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
```

`services/database.health.ts` and `services/redis.health.ts` use Terminus's `HealthIndicatorService` — see §11/§12 for the tokens. `health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health.controller';
import { ReadinessController } from './controllers/readiness.controller';
import { DatabaseHealthIndicator } from './services/database.health';
import { HealthService } from './services/health.service';
import { RedisHealthIndicator } from './services/redis.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, ReadinessController],
  providers: [HealthService, DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
```

> If you skip Postgres/Redis, remove the corresponding indicators/controllers and keep only liveness.

---

## 11. Database module (optional — PostgreSQL + Drizzle)

`src/common/database/database.constants.ts`:

```ts
export const DRIZZLE = Symbol('DRIZZLE');
export const PG_CLIENT = Symbol('PG_CLIENT');
```

`src/common/database/schema.ts` — start empty; add tables per feature later:

```ts
export {};
```

`src/common/database/database.module.ts` (lazy — no connection until first query, so boot/tests need no live DB):

```ts
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { databaseConfig } from '../config/database.config';
import { DRIZZLE, PG_CLIENT } from './database.constants';
import * as schema from './schema';

export type DrizzleDatabase = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>): Sql =>
        postgres(config.url, { max: config.maxConnections, ssl: config.ssl ? 'require' : false, prepare: false }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      useFactory: (client: Sql): DrizzleDatabase => drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE, PG_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly client: Sql) {}
  /** Closes pooled connections on shutdown. */
  async onApplicationShutdown(): Promise<void> { await this.client.end({ timeout: 5 }); }
}
```

`src/modules/health/services/database.health.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly indicatorService: HealthIndicatorService,
  ) {}
  /** Verifies DB reachability with `select 1`. */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.indicatorService.check(key);
    try { await this.db.execute(sql`select 1`); return indicator.up(); }
    catch (e) { return indicator.down({ message: e instanceof Error ? e.message : 'unreachable' }); }
  }
}
```

`drizzle.config.ts` (repo root):

```ts
import 'dotenv/config';
import { type Config, defineConfig } from 'drizzle-kit';

const config: Config = defineConfig({
  dialect: 'postgresql',
  schema: './src/common/database/schema.ts',
  out: './drizzle/migrations',
  strict: true,
  verbose: true,
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app' },
});

export default config;
```

> **TS 7 note:** annotate `const config: Config = defineConfig(...)` (without it, `tsc` raises `TS2883` on the default export). Scripts: `db:generate` → `drizzle-kit generate`, `db:migrate` → `drizzle-kit migrate`.

---

## 12. Cache module (optional — Redis)

`src/common/redis/redis.constants.ts`: `export const REDIS = Symbol('REDIS');`

`src/common/redis/redis.module.ts` (lazy connect; `maxRetriesPerRequest: null` keeps it BullMQ-compatible):

```ts
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';
import { redisConfig } from '../config/redis.config';
import { REDIS } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>): Redis =>
        new Redis(config.url, { lazyConnect: true, maxRetriesPerRequest: null, tls: config.tls ? {} : undefined }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly client: Redis) {}
  async onApplicationShutdown(): Promise<void> { if (this.client.status !== 'end') this.client.disconnect(); }
}
```

`redis.health.ts` mirrors the DB indicator using `await this.redis.ping()`.

---

## 13. Testing

`test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".*\\.e2e-spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": ["@swc/jest", {
      "jsc": { "parser": { "syntax": "typescript", "decorators": true }, "transform": { "legacyDecorator": true, "decoratorMetadata": true }, "target": "es2023" },
      "module": { "type": "commonjs" }
    }]
  }
}
```

Add a matching `jest` block in `package.json` for **unit** tests (rootDir `src`, `testRegex` `.*\\.spec\\.ts$`, same `@swc/jest` transform, `coverageDirectory: ../coverage`).

`test/app.e2e-spec.ts` — note it calls `configureApp` so routes match production:

```ts
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/bootstrap/configure-app';

describe('App (e2e)', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => app.close());

  it('GET /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });
});
```

---

## 14. Lint & format

`.prettierrc`:

```json
{ "singleQuote": true, "trailingComma": "all", "semi": true }
```

oxlint needs no config to start. Add ignore via `.oxlintrc.json` if desired:

```json
{ "ignorePatterns": ["dist", "coverage", "node_modules"] }
```

---

## 15. Module boundaries (`.dependency-cruiser.cjs`)

```js
/** Structural boundary rules enforced in CI. */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', comment: 'Circular deps indicate a broken boundary.', from: {}, to: { circular: true } },
    { name: 'not-to-spec', severity: 'error', comment: 'Production code must not import spec files.', from: { pathNot: '\\.spec\\.ts$' }, to: { path: '\\.spec\\.ts$' } },
    { name: 'no-feature-cross-import', severity: 'error', comment: 'A feature must not import another feature\'s internals.', from: { path: '^src/modules/([^/]+)/' }, to: { path: '^src/modules/(?!$1)([^/]+)/(controllers|services|repositories)/' } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { conditionNames: ['import', 'require', 'node', 'default', 'types'] },
  },
};
```

> dependency-cruiser currently supports TypeScript `< 7`; under TS 7 it prints a "missing transpiler" notice but still cruises and enforces rules. Track upstream for full TS 7 support.

---

## 16. Local infrastructure (`docker-compose.yml`)

```yaml
name: my-service
services:
  postgres:
    image: postgres:17-alpine
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: app }
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
    healthcheck: { test: ['CMD-SHELL', 'pg_isready -U app -d app'], interval: 10s, timeout: 5s, retries: 5 }
  redis:
    image: redis:7-alpine
    command: ['redis-server', '--save', '60', '1', '--loglevel', 'warning']
    ports: ['6379:6379']
    healthcheck: { test: ['CMD', 'redis-cli', 'ping'], interval: 10s, timeout: 5s, retries: 5 }
volumes:
  pgdata:
```

Start it: `docker compose up -d`.

---

## 17. Containerisation (`Dockerfile`)

```dockerfile
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/main.js"]
```

`.dockerignore`:

```gitignore
node_modules
dist
coverage
.env
.env.*
!.env.example
.git
**/*.md
```

---

## 18. CI (`.github/workflows/ci.yml`)

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm depcruise
      - run: pnpm test
      - run: pnpm test:e2e
      - run: pnpm build
```

---

## 19. `package.json` scripts

```jsonc
{
  "scripts": {
    "build": "swc src --out-dir dist --strip-leading-paths --config-file .swcrc --ignore **/*.spec.ts",
    "start": "node --enable-source-maps dist/main.js",
    "start:dev": "swc src -d dist -w --config-file .swcrc & node --watch --enable-source-maps dist/main.js",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint src test",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "depcruise": "depcruise src --config .dependency-cruiser.cjs",
    "test": "jest --runInBand",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

---

## 20. Verification checklist (run before declaring the scaffold done)

```bash
pnpm install
pnpm typecheck   # tsc --noEmit — the strict type gate (SWC does not type-check)
pnpm lint        # oxlint
pnpm depcruise   # module boundaries, 0 violations
pnpm test        # unit
pnpm test:e2e    # /health responds 200
pnpm build       # dist/main.js emitted
docker compose up -d && curl localhost:3000/health   # optional: readiness needs infra
```

All green ⇒ the baseline is ready. Add feature modules using the §5 layout.

---

## 21. Latest version reference (authoring snapshot)

| Package | Version | | Package | Version |
|---|---|---|---|---|
| `@nestjs/common` / `core` | 11.1.28 | | `typescript` | 7.0.2 |
| `@nestjs/platform-fastify` | 11.1.28 | | `@swc/core` | 1.15.43 |
| `@nestjs/cli` | 11.0.24 | | `@swc/cli` | 0.8.1 |
| `@nestjs/config` | 4.0.4 | | `@swc/jest` | 0.2.39 |
| `@nestjs/swagger` | 11.4.5 | | `jest` | 30.4.2 |
| `@nestjs/terminus` | 11.1.1 | | `@types/jest` | 30.0.0 |
| `@nestjs/testing` | 11.1.28 | | `@types/node` | 26.1.1 |
| `@nestjs/throttler` | 6.5.0 | | `supertest` | 7.2.2 |
| `@nestjs/schedule` | 6.1.3 | | `@types/supertest` | 7.2.1 |
| `fastify` | 5.10.0 | | `oxlint` | 1.74.0 |
| `@fastify/helmet` | 13.1.0 | | `prettier` | 3.9.5 |
| `zod` | 4.4.3 | | `dependency-cruiser` | 18.1.0 |
| `nestjs-zod` | 5.4.0 | | `dotenv` | 17.4.2 |
| `nestjs-pino` | 4.6.1 | | `reflect-metadata` | 0.2.2 |
| `pino` | 10.3.1 | | `rxjs` | 7.8.2 |
| `pino-http` | 11.0.0 | | `ts-node` | 10.9.2 |
| `pino-pretty` | 13.1.3 | | `tsconfig-paths` | 4.2.0 |
| `drizzle-orm` | 0.45.2 | | `source-map-support` | 0.5.21 |
| `drizzle-kit` | 0.31.10 | | `postgres` | 3.4.9 |
| `ioredis` | 5.11.1 | | | |

> Verify current latest at build time: `npm view <pkg> version`. Bump majors deliberately, run the §20 checklist after each.

---

## 22. Notes & optional add-ons

- **OpenTelemetry**: add `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node` + an exporter; initialise in `src/common/observability/instrumentation.ts` and import it as the **first** line of `main.ts` so instrumentation patches modules before load. Guard behind `OTEL_ENABLED`.
- **Rate limiting**: `@nestjs/throttler`. **Scheduling**: `@nestjs/schedule`. **Queues**: `@nestjs/bullmq` + `bullmq` (reuses the Redis module).
- **Auth**: add your IdP's OIDC/JWT strategy as a guard in `common/` or a dedicated `auth` module; enforce authorization in guards + services, never by hiding UI.
- **Integration tests with real infra**: `testcontainers` + `@testcontainers/postgresql` to spin up Postgres per test run.
- **class-validator/class-transformer** are the mainstream alternative to `nestjs-zod`; pick one validation stack and keep it consistent (this guide uses Zod so one schema serves DTOs, config and OpenAPI).
