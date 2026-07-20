# Phase 06 — Audit, Exceptions & Decision Console (Internal Audit)

> **Backend readiness: 🟡 read ready · filters/export/decision-log need backend.** `GET /audit`
> (paginated) and `GET /reports/exceptions` are live; the tamper-evident **hash chain** + `verifyChain`
> exist server-side. The **PDP decision log** read endpoint and **rich filters/export** are enhancements
> (§8). Ships a **read-only, tamper-evidence-first** console immediately.
>
> **Owner:** `InternalAudit` (read-only) + `SystemAdmin`. **Module:** `features/governance/audit/`.
> **Routes:** `/{lang}/audit`, `/{lang}/audit/exceptions`, `/{lang}/audit/decisions`. **Specs:** P10, FR-AUD-03, FR-POL-05.

---

## 1. Business context (P10)

Internal Audit gets **read-only** access to an **append-only, tamper-evident** log (hash-chained per org,
`chain_seq` monotonic under advisory lock), the **SoD-exception / override** report, and the **PDP decision
log** (every allow/deny/route with the reason and policy version). This is a governance surface: **no
writes, ever**; the value is trust (chain integrity), searchability, and exportable evidence.

**Guardrails:**
- Strictly read-only; no action mutates data. The UI must not offer edit/delete affordances.
- **Chain integrity is a feature** — surface `verifyChain` status prominently (a green "verified" or a
  loud "integrity check failed" banner). Never let a fork look benign.
- PII-minimised: the decision log is fingerprinted context, not raw PII — display accordingly.

---

## 2. Backend surface

| Method | Path | Status | Purpose |
|---|---|---|---|
| GET | `/api/v1/audit?limit=&offset=` | ✅ live | Paginated audit log (DESC) |
| GET | `/api/v1/reports/exceptions` | ✅ live | Standing SoD-override / exception report |
| GET | `/api/v1/audit/verify` | 🟠 **enhancement** | Expose `verifyChain(org)` → `{ verified, brokenAt? }` |
| GET | `/api/v1/audit?entity=&actor=&from=&to=&q=` | 🟠 **enhancement** | Rich filters |
| GET | `/api/v1/decisions/log` | 🟠 **enhancement** | Read PDP `decision_log` (write path exists) |
| GET | `/api/v1/audit?format=csv` | 🟠 **enhancement** | Server export (evidence) |

**Contracts (mirror in `features/governance/audit/audit.contract.ts`):** `AuditEntry
{ id, chainSeq, entityType, entityId, action, actorRef, occurredAt, payloadSummary }`,
`ExceptionRow { … type, subjectRef, reasons[], actorRef, occurredAt }`, `DecisionLogRow
{ ruleType, decision, reasons[], policyVersion, correlationId, occurredAt }` (shape confirmed when
endpoints land; today only audit + exceptions are parsed).

---

## 3. Screen design

### `/audit` — Audit Log (`pages/audit-log-page.tsx`)
- **Integrity banner** (top): `verifyChain` status — green "Chain verified · N entries" or a danger banner
  "Integrity check failed at seq X" (from enhancement; until then show entry count + "append-only" note).
- `ResourceTable<AuditEntry>` (server-paginated): Seq | When | Actor | Entity | Action | ⋯ → `DetailDrawer`
  showing the full entry + `prev_hash/row_hash` (evidence). **FilterBar:** search, actor, entity type,
  date range (wired to filter params when available; client-filter the current page meanwhile).
- **Export** (`ExportButton`) — CSV evidence (client now, server later).

### `/audit/exceptions` — Exception report (`pages/exceptions-page.tsx`)
- `ResourceTable<ExceptionRow>`: When | Type (SoD override / break-glass / hard-block override attempt /
  waiver) | Subject | Reasons | Actor | ⋯. Reason codes localised via the shared `sod` map (file 03).
  Detail drawer per row.

### `/audit/decisions` — Decision log (`pages/decision-log-page.tsx`)
- `ResourceTable<DecisionLogRow>`: When | Rule type | Decision | Policy version | Correlation | ⋯ →
  `DetailDrawer` with the **`DecisionTrace`** component (shared from Phase 05) explaining *why*
  allowed/denied/routed. Filters: rule type, decision, date range. **Needs the decision-log read endpoint**
  (§8) — until then this route shows a guided empty-state ("Decision log endpoint pending") behind a
  capability flag, so the nav/route exist without a broken screen.

---

## 4. Reusable components used / created

| Component | Source | Notes |
|---|---|---|
| `ResourceTable` (server-paginated variant), `DetailDrawer`, `FilterBar`, `AdminPageLayout` | shared kit | reused; server pagination pattern hardened here (file 09) |
| `IntegrityBanner` | **new shared** | verified/failed chain status (reusable for any tamper-evident view) |
| `DecisionTrace` | shared (Phase 05) | reused verbatim in the decision log |
| `ExportButton` + `toCsv` | shared (Phase 03) | evidence export |
| `HashBadge` | **new shared** | truncated hash with copy (evidence display) |

---

## 5. RBAC & governance

- Routes `RequireRole roles={['InternalAudit','SystemAdmin']}`.
- **No mutations** — the module exports zero write hooks; any affordance that looks actionable is
  read/copy/export only.
- Server pagination + filters keep large logs performant; never load the whole chain client-side.

---

## 6. i18n keys (`governance.audit.*`)

```
title, subtitle, tab-ish routes: log, exceptions, decisions,
integrity.verified, integrity.failed, integrity.pending,
log.col.seq|when|actor|entity|action, exceptions.col.*, decisions.col.*,
filter.actor|entity|ruleType|decision|dateRange, action.export, empty.decisionsPending, detail.evidence
```

---

## 7. Tests

- `audit-log-page.test.tsx` — paginated rows from MSW; detail drawer shows hashes; integrity banner states.
- `exceptions-page.test.tsx` — rows + localised reason codes.
- `decision-log-page.test.tsx` — capability-flag empty-state; with mock endpoint → rows + DecisionTrace.
- `integrity-banner.test.tsx`, `hash-badge.test.tsx` (shared).

**MSW:** `/audit` (paginated), `/reports/exceptions`, (mock `/audit/verify` + `/decisions/log` for the
enhancement-gated tests).

---

## 8. Backend / DB change register (proposed)

1. **`GET /audit/verify`** — expose `AuditService.verifyChain(org)` as `{ verified, brokenAtSeq? }`. **Low.**
2. **Rich audit filters + pagination metadata** — `entity, actor, action, from, to, q, page, pageSize` +
   total count on `GET /audit`. **Medium.**
3. **`GET /decisions/log`** — read the existing `decision_log` (write path already exists via
   `DecisionLogService`), PII-minimised, filterable by ruleType/decision/date. **Low–medium.**
4. **Server-side CSV export** for audit + exceptions + decisions (large, tamper-evident evidence). **Medium.**

Until these land, ship the **Audit Log + Exceptions** (both live) with client-side filter/export and the
Decision-log route behind a capability flag.

---

## 9. Exit checklist

- [ ] Audit log + exceptions render from live endpoints; server-paginated table pattern established.
- [ ] Integrity banner + hash evidence in detail drawer.
- [ ] Decision-log route present, `DecisionTrace` wired, gated by capability until endpoint lands.
- [ ] `IntegrityBanner`, `HashBadge` in shared kit + tested; zero write hooks in the module.
- [ ] RBAC guard (InternalAudit/SystemAdmin); i18n EN/AR; RTL verified.
- [ ] Backend items filed in register (file 10).
- [ ] Gate green.
