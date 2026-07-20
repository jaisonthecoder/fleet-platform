# Azure-friendly Testcontainers modules

AD Ports services on Azure typically need Testcontainers to stand in for:

- **PostgreSQL** — `@testcontainers/postgresql` for primary data.
- **MS SQL Server** — `@testcontainers/mssqlserver` for legacy services.
- **Redis** — `@testcontainers/redis` for BullMQ + caching.
- **Kafka** — `@testcontainers/kafka` (or Redpanda) for event-driven slices.
- **Azure Service Bus emulator** — `@testcontainers/azureservicebus` for ASB consumers/producers.
- **Azurite** — `@testcontainers/azurite` for Blob/Queue/Table storage.
- **CosmosDB emulator** — `@testcontainers/cosmosdb` for Cosmos consumers (heavy; prefer in nightly).
- **LocalStack** — `@testcontainers/localstack` for AWS adapters in hybrid services.

## Container reuse policy

- One container per **test suite** (not per test) for fast suites — share via Jest `globalSetup`.
- One container per **test file** when migrations are expensive or schema mutates.
- Always apply migrations on container start; never seed inline.

## Wait strategies

Use module-provided wait strategies. Custom log-message waits should set a 60s ceiling.

## CI

GitHub Actions: `services:` block for shared databases is acceptable for unit suites; Testcontainers is mandatory for integration suites because production parity matters more than CI speed.
