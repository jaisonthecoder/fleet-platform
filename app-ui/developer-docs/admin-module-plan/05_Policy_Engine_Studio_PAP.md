# Phase 05 — Policy Engine Studio (PAP — Decision-Table Authoring)

> **Backend readiness: 🟡 engine ready · PAP HTTP needs backend.** The **PDP** (evaluator, registry,
> Redis cache, `policy_version` read-through, activation service) is **built and stable**, and
> `POST /api/v1/decisions/evaluate` is live (great for the **dry-run** panel). But `PolicyAdminService`
> (the write/activation path) is **service-only — no authenticated HTTP endpoints yet**. This phase
> ships the **read + dry-run studio** against live APIs and specifies the small PAP surface (§8) to unlock
> authoring/activation.
>
> **Owner:** `SystemAdmin` (author) + a second approver (activation). **Route:** `/{lang}/admin/policy`
> (supersedes the current `/{lang}/policy` coming-soon → add a redirect for one release). **Spec:** I1.

---

## 1. Business context (P3 — the crown jewel)

The platform is reusable *because* rules live in **configuration, not code**, following the
industry-standard **PAP / PDP / PEP** split (XACML/ABAC + DMN decision tables):
- **PAP** (this screen) — admins **author rules as decision tables** (business-readable, testable, diffable).
- **PDP** — one stateless service: `evaluate(ruleType, context) → { decision, reasons[], policyVersion }`.
- **PEP** — booking, entitlements, compliance, fines **enforce** answers; they contain no rule logic.

Rules are **versioned + immutable**; every transaction records the **policy version in force**. Governance
lifecycle: **Draft → In Review → Approved → Active (effective-dated) → Superseded**. The PDP **fails safe**
(deny + escalate) and must stay **< 200 ms** (it's in the booking path).

**Phase-1 registers 12 rule types:** booking buffer · max duration · booking approval chain · entitlement
approval chain · dedicated-vehicle eligibility · driver eligibility gate · compliance alert ladders ·
hard-block conditions · fines HR threshold · black-point timeframe · consent re-consent tolerance · fuel
deviation threshold.

---

## 2. Decision-table model (mirror `decision-table.ts`)

```ts
type PolicyDecision = 'ALLOW' | 'DENY' | 'VALUE' | 'ROUTE'
interface DecisionRow {
  when: Record<string, Condition>   // per-input predicate: eq | gte | lte | in | between
  decision: PolicyDecision
  value?: unknown                   // for VALUE (e.g. buffer=15) / ROUTE (chain)
  reasons?: string[]
}
interface DecisionTable {
  ruleType: string
  version: string
  scope?: string                    // hierarchy scope (org default vs pool override)
  rows: DecisionRow[]               // evaluated top-down, first match wins
  default: DecisionRow              // mandatory safe-default (fail-safe)
}
```
Each rule type declares an **input schema** (from `policy-rules.contract.ts`) and an **output contract**
with reason codes — the editor uses these to render the right columns and validate rows.

---

## 3. Backend surface

| Method | Path | Status | Purpose |
|---|---|---|---|
| POST | `/api/v1/decisions/evaluate` | ✅ live | **Dry-run** a context → `{ decision, reasons[], policyVersion }` |
| GET | `/api/v1/admin/policy/rules` | 🟠 **enhancement** | List rule types + active version summary |
| GET | `/api/v1/admin/policy/rules/:ruleType` | 🟠 **enhancement** | Active table + version history |
| POST | `/api/v1/admin/policy/rules/:ruleType/versions` | 🟠 **enhancement** | Save Draft table |
| POST | `/api/v1/admin/policy/rules/:ruleType/activate` | 🟠 **enhancement** | Activate (effective-dated, 2nd-approver) |

The write path maps 1:1 to the **existing** `PolicyAdminService.activate()` + `PolicyRepository.activate()`
(supersede-then-insert) — so §8 is mostly **exposing existing service methods over HTTP with `@Roles`**, not
new domain logic.

---

## 4. Screen design (`pages/policy-studio-page.tsx`)

`AdminPageLayout`, three-pane studio.

```
┌ Rule types ┬──────────── Decision-Table Editor ─────────────┬ Test / Versions ┐
│ • booking- │  <RuleType> — v12 (Active) · effective 2026-…   │ ▸ Test this rule │
│   buffer   │  ┌ condition cols (from input schema) ┬ outcome ┐│  inputs → Trace  │
│ • max-     │  │ passengers ≥ | duration ≤ | grade  │ decision││                  │
│   duration │  ├───────────────────────────────────┼─────────┤│ ▸ Versions       │
│ • driver-  │  │ …editable rows (add/remove/reorder)│ ALLOW   ││  v12 Active      │
│   elig.    │  ├───────────────────────────────────┼─────────┤│  v11 diff ↕      │
│ • …(12)    │  │ DEFAULT (mandatory, safe)          │ DENY+esc││  v10 …           │
└────────────┴───────────────────────────────────────┴─────────┴──────────────────┘
   status: Draft/In Review/Approved/Active   [ Save draft ] [ Submit for approval ] [ Activate ]
```

### Rule-type list (left)
- From `GET /admin/policy/rules` (enhancement) — until then, seed from the known **12 rule types** +
  fetch active version via a temporary read. Each shows: ruleType, active version, status chip, scope.

### Decision-Table Editor (centre) — **`DecisionTableEditor`** (new shared)
- Renders columns from the rule's **input schema** (condition cells with operator pickers: `eq/gte/lte/
  in/between`) + an **outcome** cell (`ALLOW/DENY/VALUE/ROUTE` + value/reasons).
- **Add / remove / reorder rows** (drag or up/down); **first-match-wins** order made explicit with row numbers.
- **Mandatory default row** — cannot be deleted; must be a safe default (the UI enforces presence + warns
  if default is not DENY for gated rule types).
- Genuinely **no-code**: business users edit predicates via controls, not JSON — but a **JSON/raw view**
  (read-only or advanced) is available for power users + diffing.
- Live client validation against the rule's Zod input schema; invalid predicates flagged inline.

### Test panel (right) — **dry-run against the real PDP**
- Form built from the rule's input schema → `POST /decisions/evaluate` → shows **matched row**, decision,
  `reasons[]`, and `policyVersion` as a **Decision Trace** (the same trace component reused by the
  Internal-Audit decision log, file 06, and the line-manager/CEO approval evidence cards later).
- This works **today** (evaluate is live) — the test panel is shippable before the write API lands.

### Versions panel (right, tab)
- Version history with **diff** (`JsonDiffViewer` new shared) between any two versions; shows who/when/
  effective date; **second-approver** step surfaced for activation (SoD: author ≠ approver).

### Lifecycle actions (footer)
- **Save draft** → POST version (Draft). **Submit for approval** → status In Review. **Activate** →
  POST activate (requires 2nd approver; effective-dated). Each confirmed; each audited; each invalidates
  the rule + (server-side) the Redis cache so the PDP serves the new version.

---

## 5. Reusable components used / created

| Component | Source | Notes |
|---|---|---|
| `DecisionTableEditor` | **new shared** | schema-driven condition→outcome grid; the studio's core |
| `DecisionTrace` | **new shared** | renders `{decision, reasons[], policyVersion, matchedRow}`; reused by audit decision log + approval evidence |
| `JsonDiffViewer` | **new shared** | version diffs; reused anywhere immutable versions are compared |
| `RuleTypeList`, `LifecycleBar` | module-specific | left list + status/actions |
| `AdminPageLayout`, `DetailDrawer`, `Tabs`, `useConfirm` | shared kit | reused |

`DecisionTrace` and `JsonDiffViewer` are deliberately generic — high reuse value.

---

## 6. RBAC & governance

- Route `RequireRole roles={['SystemAdmin']}`.
- **Author ≠ approver** for activation (SoD-05 spirit) — the UI blocks self-activation of one's own draft
  and shows the reason; the backend is the authority.
- All lifecycle transitions audited; immutability of published versions is respected (edits create a new
  Draft, never mutate an Active version).

---

## 7. i18n keys (`admin.policy.*`, `policy.decision.*`, `policy.rule.<ruleType>`)

```
title, subtitle, ruleTypes, editor.conditions, editor.outcome, editor.addRow, editor.defaultRow,
editor.firstMatch, op.eq|gte|lte|in|between, decision.ALLOW|DENY|VALUE|ROUTE,
test.title, test.run, test.matchedRow, test.noMatch, versions.title, versions.diff, versions.activate,
lifecycle.draft|inReview|approved|active|superseded, action.saveDraft, action.submit, action.activate,
confirm.activate*, sod.selfActivate, policy.rule.<eachOf12>   # localised rule-type names
```

---

## 8. Backend / DB change register (proposed — mostly *expose existing service*)

1. **PAP read endpoints** — `GET /admin/policy/rules` (+ `:ruleType` with version history). Wraps
   `PolicyRegistryService` + `PolicyRepository.loadActiveTable`. **Low.**
2. **Save Draft version** — `POST /admin/policy/rules/:ruleType/versions` (status Draft). New light table
   status handling; the compiled `DecisionTable` already stored verbatim in `policy_version.decision_table`
   JSONB. **Low–medium.**
3. **Activate** — `POST /admin/policy/rules/:ruleType/activate` wrapping the **existing**
   `PolicyAdminService.activate()` (supersede-then-insert + cache invalidate) with `@Roles(SystemAdmin)`
   and a **second-approver** check. **Low** (logic exists).
4. **Dry-run is already live** — no change.
5. **(Optional) validation endpoint** — `POST /admin/policy/rules/:ruleType/validate` to server-check a
   draft table against the rule input schema before save. **Low.**

Because the domain logic already exists, this phase is unusually cheap to complete end-to-end — and the
**test panel + read** ship immediately on the live PDP.

---

## 9. Exit checklist

- [ ] Rule-type list + read of active table/versions (temporary seed of the 12 types until GET lands).
- [ ] `DecisionTableEditor` (schema-driven, first-match, mandatory safe default) + raw/JSON view.
- [ ] **Test panel dry-runs the live PDP** (`/decisions/evaluate`) → `DecisionTrace`.
- [ ] Versions + `JsonDiffViewer`; lifecycle bar (draft/submit/activate) with SoD self-activate guard.
- [ ] `DecisionTableEditor`, `DecisionTrace`, `JsonDiffViewer` added to shared kit + tested.
- [ ] `/policy` → `/admin/policy` redirect for one release.
- [ ] RBAC guard; i18n EN/AR incl. rule-type names; RTL verified.
- [ ] PAP endpoints filed in register (file 10) — mostly *expose existing service*.
- [ ] Gate green.
