# MSW Handler Catalog (AD Ports)

## Tenant-scoped fixture

Use `x-tenant-id` header to switch fixtures; tests pass the header through the API client.

## RTL parity (`ar-AE`) fixture

Provide an Arabic fixture set alongside the English one. Every page test loads both and asserts no Latin glyphs leaked into `ar-AE` strings (`/[A-Za-z]/.test(arabicLabel)` must be false).

## Asia/Dubai clock fixture

When the handler returns a timestamp, format it with `Intl.DateTimeFormat('en-AE', { timeZone: 'Asia/Dubai' })` and assert against a fixed `vi.setSystemTime(new Date('2026-01-15T08:00:00+04:00'))`.

## OpenAPI-driven handler stubs

Generate handler stubs from the consumed service's OpenAPI; keep generated handlers in `src/mocks/generated/` and hand-tuned ones in `src/mocks/handlers/`.
