# Sub-Phase 1G — Hardening → Production Readiness (Block G)

**The binding validation of the whole MVP** with **real modules + migrated data** (not the Phase-0 floor on a near-empty DB). Nothing new is built; everything is proven. This block owns closing the Phase 1 [production-readiness gate](09_production-readiness-gate.md).

- **Entry dep:** 1A–1F complete and individually green.
- **Exit:** Phase 1 gate fully green, reviewer-verified, evidence attached; sponsor/security/ops go/no-go signed.

---

## 1. Binding load / soak / failover (the real run)
Run with real modules + migrated pilot data (the Phase-0 run was a **floor**; this is the **binding** run — P0B-R1-3):

| Target | Threshold |
|---|---|
| Eligibility gate | p95 **< 500 ms** |
| PDP `evaluate()` | p95 **< 200 ms** |
| `api` event-loop lag | p99 **< 10 ms** during burst |
| Ingest lag recovery | **→ 0 within 60 s** after a 5,000-vehicle burst (~167 msg/s, 10× burst) |
| Booking concurrency | 500 concurrent `POST /bookings` with no double-book, no lost consent |

- **Soak** — sustained load holds latency + event-loop targets without leak/regression.
- **Failover** — PDP kill ⇒ consumers DENY + escalate; DB failover; Redis loss degrades to read-through (no decision failure).

## 2. Migration dry-runs
- Forward + compensating migrations for `0003`–`0010` proven in CI and on a prod-like dataset; idempotent/resumable backfills; extension allowlist confirmed per environment.

## 3. Disaster recovery drill (timed)
- **RPO ≤ 1 h / RTO ≤ 4 h** restore, timed.
- **Replay drill** — outbox / inbox / DLQ / `scheduled_work` replay after a simulated crash: no lost or duplicated publishes; idempotent consumers dedupe.

## 4. Security
- **Security pipeline** (SAST/DAST/SCA/secrets/IaC/container scans) green with gates.
- **Penetration test** passed; findings closed or accepted-with-dated-risk.
- **Audit hash chain verifies end-to-end** under load; UPDATE/DELETE impossible (role-revoked).
- **Dev-login cannot activate in prod config** (CI-checked); decision/audit logs store minimized PII (privacy review noted).

## 5. Privacy sign-off
- **D4 (PDPL) sign-off** confirmed; telematics retention + off-shift masking match the decided policy.

## 6. UAT & go/no-go
- **GS Pool UAT** signed; **no open Sev-1 / Sev-2**.
- **Sponsor / security / ops go/no-go** signed; **rollback authority named**.

## 7. Critique closure
- Every Phase-1 **Round 1 & Round 2** finding is **closed or accepted-with-dated-risk** by the reviewer (see [08_critique-and-gap-analysis.md](08_critique-and-gap-analysis.md)).

## 8. Traceability
- **Gate items advanced:** the entire [Phase 1 gate](09_production-readiness-gate.md) — load, DR, security, pen test, UAT, go/no-go, critique closure.
- **Migration catalog:** validates `0003`–`0010`.
- **D-list:** confirms D4 signed; flags any still-open D-values as accepted-with-dated-risk.

> Phase 1 is the core loop. It is **not** production-ready until every gate box is green with attached evidence (a doc edit is not evidence).

**Next:** [Phase 2 — Scale & Automate](../02_phase2-scale-automate.md).
