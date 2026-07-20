# Sub-Phase 1F — Read Models (Block F)

**Role-aware read models over everything built in 1B–1E** — the dashboards and operational overview, with cost masking by role and scope. Read-only; no new domain state.

- **Entry dep:** 1B–1E (reads vehicles, telematics, bookings, compliance, entitlements, fines).
- **Unlocks:** 1G (validated with real data).
- **Migrations:** none (materialized views / read-optimised query services).

---

## 1. Module — `dashboards/`
- **Read-optimised query services / materialized views** over the slice tables — never re-implementing domain rules, only aggregating committed state.
- **Role + scope cost-masking** — **Finance sees unmasked** cost; **Executive sees aggregate-only**; other roles per policy. Masking is enforced server-side (never client-hidden).
- **Feeds:**
  - **Utilisation** (per vehicle / pool / cluster; under/over-use signals).
  - **Fines-per-user.**
  - **Compliance heat map** (expiries approaching / blocks).
  - **Entitlement inventory** (dedicated allocations + justification status).
  - **Telematics coverage %** (devices reporting vs fleet).

## 2. Scope discipline (P1B-R1-7)
- The "basic executive view" is scoped to what is **measurable now at one pool**. Each KPI is tagged **measurable-now** vs **Phase-2** so the exec view does not over-promise; M9 ships only the measurable set.

## 3. Contracts
`contracts/operations-overview.contract.ts` (replace the mock's shape with the real read model), `contracts/dashboard-*.contract.ts` per tile.

## 4. Endpoints
`GET /operations/overview` (**replaces the Phase-0 mock** `operations-overview.service.ts`), plus dashboard read endpoints per tile. All scope- and role-filtered.

## 5. Events
None emitted (read side). Consumes committed state / refreshes materialized views on domain events where needed.

## 6. Tests
- **Cost masked per role** — Finance unmasked, Executive aggregate-only, others per policy (executable).
- **KPI tiles** return correct aggregates over seeded data.
- **Scope change refetches** — changing the active scope returns the right subtree (roll-up correctness from 1A hierarchy).
- **No rule logic** — dashboards never decide; they read.

## 7. Exit gate
- Cost masked per role; KPI tiles live; scope changes refetch; `GET /operations/overview` serves the real read model (mock retired).

## 8. Traceability
- **FRs:** FR-DASH-01..08 (utilisation, fines-per-user, compliance heat map, entitlement inventory, coverage), P11 (reporting/analytics), role-based cost visibility.
- **Critique resolved:** P1B-R1-7 (measurable-now scoping) ✅.
- **Gate items advanced:** "cost masked per role; KPI tiles live".
- **Migration catalog:** none.
- **D-list:** none blocking.

**Next:** [Sub-Phase 1G — Hardening & Gate](07_sub-phase-1g_hardening-and-gate.md).
