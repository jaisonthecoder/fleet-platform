# Documentation

**Governing document: PRD v4.0.** Phase 1 sequence: [`plans/Project-Kickoff-and-Phase1-Plan.md`](plans/Project-Kickoff-and-Phase1-Plan.md).

The nine v4 rules that override earlier assumptions are at the top of [`../CLAUDE.md`](../CLAUDE.md) —
read those first, because several reverse things the v2 and v3 documents still say.

> **Reorganised 18.09.2026.** Every document now sits in a folder named for what it is. If a
> link in an older document points at a path that no longer exists, the file has moved, not
> gone — find it by name in the tables below.

---

## Start here

| # | File | Why |
| --- | --- | --- |
| 1 | [`../CLAUDE.md`](../CLAUDE.md) | The rules. Nine v4 overrides, six foundation rules, definition of done |
| 2 | [`cargowise-and-quotation/`](cargowise-and-quotation/README.md) | **The newest direction (18.09.2026).** The CargoWise communication surface and the portal quote flow |
| 3 | [`plans/Project-Kickoff-and-Phase1-Plan.md`](plans/Project-Kickoff-and-Phase1-Plan.md) | **What to build next.** Phase 1 stage by stage |
| 4 | [`PRD-Noatum-Customer-Platform.md`](PRD-Noatum-Customer-Platform.md) | PRD v4.0. Read only the sections your task references |
| 5 | [`noatum-designsystem.md`](noatum-designsystem.md) | Brand tokens and components, if the task has UI |

---

## The governing few, flat in this folder

| File | What it is |
| --- | --- |
| `PRD-Noatum-Customer-Platform.md` | **PRD v4.0 — governing.** Requirements, priorities, open questions OQ-n |
| `Simplification-Register.md` | What was deliberately dropped and the seam kept for each. **Check before adding a table, runtime, cache or screen** |
| `gaps.md` | Needed but absent from the PRD, proposals awaiting sign-off, and the implementation gap register |
| `glossary.md` | Freight-forwarding and platform terms. Read this before your first slice |
| `noatum-designsystem.md` | Tokens, component recipes, brand voice. Authoritative for anything visual |
| `03-Agent-Metaprompt.md` | The task, review, fix and docs-update prompts |

---

## The folders

### `cargowise-and-quotation/` — the newest plan, and it wins

The product owner's direction of 18.09.2026: open every communication line to CargoWise but
hold the last mile, and build the complete quote flow inside the portal. Where this disagrees
with anything else, **this wins**.

| File | What it is |
| --- | --- |
| `README.md` | The direction, what it supersedes, and the build order C1–C8 |
| `01-CargoWise-Communication-Surface.md` | Every adapter operation, the outbound store, the held transport, the status endpoints |
| `02-Quotation-Flow-and-Status.md` | The status machine, claiming, manual pricing, publishing, optional approval |

### `ai-implementation/` — the AI capability

Demo scaffolding built 22.09.2026, deliberately throwaway. One capability: a customer
uploads an invoice or pastes an enquiry and the quote request fills as an editable draft.
**Not production-ready** — its own §6 lists what is missing.

| File | What it is |
| --- | --- |
| `README.md` | Status, read order, and where to resume |
| `01-What-We-Are-Building.md` | Scope, the extract-versus-decide rule, the logistics rules applied, and what it must never do |
| `02-Build-Status.md` | Every file, what is done, what is left, and the decisions not to reverse |
| `03-Staff-Pricing-Assistant-Plan.md` | Plan only. The staff assistant, and which proposed capabilities are blocked for want of rate, schedule and outcome data |

### `plans/` — what to build, and in what order

| File | What it is |
| --- | --- |
| `Project-Kickoff-and-Phase1-Plan.md` | **The Phase 1 sequence.** Ten stages, in build order |
| `01-Vertical-Slice-Implementation-Plan.md` | Slice backlog: goal, dependencies, DB, types, API, UI, tests per slice |
| `Quotation-Module-Phase-Plan.md` | Quotation phases Q0–Q5, the scope cap, and **§0: which document wins** |
| `Remediation-Plan-Foundation-Gaps.md` | The gap register and packages R1–R10. Owns the foundation, **not** quotations |
| `Implementation-Plan-Noatum-Customer-Platform.md` | Architecture and phasing, the level above the slices |
| `03-Phased-Delivery-Plan.md` | The P1–P5 delivery phases |
| `implementation-plans/` | Per-module detail, including the pilot authentication plan and the P1.01–P1.12 stage plans |

### `quotation/` — the build sheets

One short file per phase, Q0 to Q5, plus `00-Shared-Rules.md`. These own field-level and
screen detail. Read `README.md` there first.

### `requirements/` — the numbered requirements

`01-Functional-Requirements.md` and `02-Non-Functional-Requirements.md`.

### `architecture/` — how the system hangs together

| File | What it is |
| --- | --- |
| `KB-CW1-Integration-Multi-Tenant.md` | How an inbound CargoWise message is assigned to the right customer. **The highest-risk area in the platform** |
| `11-CW1-Data-Contracts-and-Standards-Research.md` | What CargoWise messages look like, with sources |
| `12-CW1-Organisation-Schema-and-Portal-Directory-Design.md` | The organisation schema and our mirror of it |
| `org-customer-relation-asper-cw.md` | How CargoWise relates organisations to customers |
| `KB-CO2-Emissions-Calculator.md` | Emissions methodology and factors (deferred scope) |

### `integration/` — what we exchange with CargoWise

`CargoWise-Integration-Requirements.md` · `Customer-Portal-Workflows-and-CargoWise-Information-Exchange.md` ·
`CargoWise-Exchange-Matrix-and-Asks.md` · `NOTE-CargoWise-Session-Pack.md`

### `design/` — how one capability works

Identity and access · customer onboarding and user management · internal quote pricing ·
the CW1 integration surface and quotation paths · customer identity explained · the internal
quotation pricing workflow · the customer onboarding flow design.

### `adr/` — architecture decisions

Migrations · frontend framework · tenancy controls · Phase 1 simplifications · UI structure ·
pilot portal-managed authentication · shipment party model · background work queue.

### `lld/` — low-level design

DDL, endpoints, invariants and test lists: organisation management, the CW1 simulator.

### `research/`, `operations/`, `process/`

| Folder | What it holds |
| --- | --- |
| `research/` | Freight-forwarding and quotation research; customer organisation and access research |
| `operations/` | Azure and DevOps setup and inspection, production readiness, the Azure team request, the staff role demo, assistant context and memory |
| `process/` | How we work: the external user onboarding flow, and the organisation / customer / branch / region explainer |

### `meetings/`, `briefings/`, `reviews/`, `walkthroughs/`

| Folder | What it holds |
| --- | --- |
| `meetings/` | KT minutes and Q&A. The session of 09.09.2026 produced the v4 override rules, so it is evidence rather than history |
| `briefings/` | Stakeholder decks, slides and diagrams — draw.io, HTML and PNG. **Presentation, never specification** |
| `reviews/` | Critiques of our own plans and code |
| `walkthroughs/` | The same story end to end, for explaining onboarding |

### `reference-data/` and `archive/`

`reference-data/` holds the CargoWise document and event catalogues and the source URL list.
`archive/` holds the raw v3 and v4 intake drops, untouched — **never edit, never cite as a
source.** The working copies above are what the project follows.

---

## Before you trust an older document

**The quotation scope was capped at director level on 17.09.2026,** then the flow was
redirected by the product owner on 18.09.2026. The organisation has no rate database, no rate
storage, no standard format and **no standardised quoting process**, and its system landscape
is being redesigned. Anything describing a pricing queue screen, charge codes, or an automatic
end-to-end quoting process is retained design, not the build.

**Two things the cap does not forbid**: **claiming** a request, and **several priced options**
per quote, from the UI mockups. A person types every option; nothing derives, compares or ranks
them. The cap forbids *computing* a price, not offering a choice.

**When two documents disagree**, the order is: `cargowise-and-quotation/` first, then the
`quotation/` build sheets for detail, then `plans/Quotation-Module-Phase-Plan.md` §0 for scope.
`plans/Remediation-Plan-Foundation-Gaps.md` owns the foundation and explicitly not the
quotation module. **Fix the disagreement in both files, in the same change.**

**v4 reversed several v2 and v3 assumptions.** The nine rules at the top of `CLAUDE.md` win
over anything written earlier — most importantly: no rate management exists, internal pricing
is in Phase 1, and quote, booking and shipment are three separate entities with no one-to-one
chain.

**The v4 drop was written against a shared-package layout this repo no longer uses.** There is
no `packages/` folder; each app under `apps/` is self-contained. `CLAUDE.md` holds the
authoritative paths.

**Pilot authentication amendment (15.09.2026):**
[ADR-006](adr/ADR-006-pilot-portal-managed-authentication.md) adopts portal-managed
external-customer and local bootstrap-admin authentication; see the
[phased implementation plan](plans/implementation-plans/Pilot-Portal-Authentication-Implementation-Plan.md).
Staff SSO remains supported.
