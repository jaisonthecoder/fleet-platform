# Quotation module — build plan

| | |
| --- | --- |
| Version / date | 1.0 / 17.09.2026 |
| Status | Working build files for the quotation module. One file per phase, handed over one at a time |
| Parent document | [Quotation-Module-Phase-Plan.md](../plans/Quotation-Module-Phase-Plan.md) — the authoritative sequence and the reasoning behind it |
| Governed by | PRD amendment 17.09.2026 · [CW1 integration surface](../design/CW1-Integration-Surface-and-Quotation-Paths.md) · [Internal quote pricing](../design/Internal-Quote-Pricing-in-Portal.md) |

This folder is the **working** copy: short, self-contained files an agent or a developer
can pick up one at a time. The parent document is the **reasoning**: why the scope was
capped, what was deliberately excluded, and what the seams are. Read the parent once. Read
one file here per phase.

---

## Which document wins

**Read [`docs/cargowise-and-quotation/`](../cargowise-and-quotation/README.md) first.** The
product owner changed direction on 18.09.2026: the portal now carries the standard quote
flow, portal pricing is **on**, publishing is a separate step, and the customer no longer
waits for CargoWise. That plan wins over anything here that disagrees.

Several people and agents work on this module at once. Documents drifted because none said
which was authoritative. The full table is
[§0 of the parent](../plans/Quotation-Module-Phase-Plan.md). The short version:

| | |
| --- | --- |
| **These build sheets win on HOW** | Tables, columns, routes, request bodies, screen behaviour, anything driven by a UI mockup |
| **The parent wins on WHAT and WHETHER** | Phase order, the scope cap, what is deliberately excluded, where each seam lives |
| **Superseded for Phase 1** | PRD FG-3, slices S1.08–S1.10 and SP.01–SP.06, kick-off F1.08. Kept as the fuller design, not as instructions |
| **Not a quotation document** | `docs/plans/Remediation-Plan-Foundation-Gaps.md`. It owns the foundation these phases depend on, and explicitly not the module |

**Two rules.** If a build sheet adds a field, a table or a screen behaviour, it is right —
but it must not widen the scope in §7 of the parent. And fix any disagreement **in both
files in the same change**, never by leaving one behind.

**Richer detail is not scope creep.** Multiple priced options, carrier name, transit days
and a recommended option came from the UI mockups after the parent was first written. They
are **in**, because a person types every one and nothing derives them. What stays out is
anything that *computes* a price.

---

## The phases

| Phase | Delivers | Size | Needs CargoWise | Other dependency |
| --- | --- | --- | --- | --- |
| [Q0](Q0-Straighten-The-Record.md) | The record made true and safe | Small | No | None |
| [Q1](Q1-Record-A-Price.md) | A person claims a request and records a price | Medium | No | Q0 · **mockups** for the screen |
| [Q2](Q2-Document-As-Answer.md) | A document can be the answer | Small | No | Q1 · Azure Blob container |
| [Q3](Q3-Outcome-Expiry-Measurement.md) | Submit, accept, decline, expire, and the measurement | Medium | No | Q1 · R4 scheduler for expiry · **mockups** for the listings |
| [Q4](Q4-Outbound-To-CargoWise.md) | The request copy goes out | Medium | Yes | R1, R3, R4 |
| [Q5](Q5-Inbound-From-CargoWise.md) | A priced quote comes back | Medium | Yes | Q1, Q4, R1, R3, R4 |

**Q0 to Q3 are the light module and need nothing from CargoWise.** At the end of Q3 a
customer can request a quote, a Noatum person can answer it, and the customer can accept
it, with no integration in existence. Q4 and Q5 connect it.

Read [00-Shared-Rules.md](00-Shared-Rules.md) before any phase. It holds the rules that
apply to all six and the things that must never be built.

---

## Before you start: what the code actually looks like

Verified against source on 17.09.2026. The documents describe intent; the code has drifted
from it. Trust this table over any older description.

| Area | State |
| --- | --- |
| `quote` table | Exists, sound skeleton. `mode`, `originCode`, `destinationCode`, `payload`, `grossWeightKg`, `chargeableKg`, `totalMinorUnits`, `currency`, `validUntil`, `reference` unique per group |
| `QuoteStatus` | `draft`, `rated`, `rate_failed`, `expired`, `accepted`, `rejected`. Machine-shaped; `rated` is a rate-engine word |
| Routes | `GET /quotes`, `GET /quotes/:id`, `POST /quotes`, `POST /quotes/:id/rate`. All permission-guarded |
| Permissions | `quotes.read`, `quotes.create`, `quotes.submit`, `quotes.accept`, `quotes.cancel` **already exist and are seeded**. New in Q1: `quotes.price`, `quotes.claim`, `quotes.claim.override` |
| Feature switches | Only `quotations.instant_rate`. `portal_pricing` and `cw1_request_sync` are new |
| Status rules | None. No `quote.status.ts`, no transition table, no tests |
| Pricing | Only `rate()`, calling a rate engine with no configured source. **No way for a person to record a price** |
| UI | **`src/features/quotes/` is an empty `.gitkeep`.** There is no quote screen of any kind, for staff or for customers |
| Expiry | `quote-expiry.handler.ts` is a log-only stub. Nothing schedules it |
| Queue | pg-boss runs. `JobsService.enqueue()` has zero production callers |
| `AnalyticsEvent` | Emitted to the logger. **There is no `analytics_event` table**, so nothing is queryable |

---

## Open questions that touch this module

| # | Question | Owner | Blocks |
| --- | --- | --- | --- |
| OQ-27 | Where a branch prices outside any system, may the price be released without passing through CargoWise | Director | **Answered by the mockup** as the `pubMode` setting, `cw1` \| `direct`, scoped per branch |
| OQ-11 | Whether cost and margin are captured; the approval threshold | Sponsor + Head of Pricing | **Answered by the mockup**: `costCapture` off by default, `threshold` EUR 10,000 |
| OQ-25 | Interface and availability of the AI email drafting service | Digital Products | Nothing. Template fallback covers it |
| — | Which integration mechanism, and CargoWise's data model | CargoWise team | Q4 and Q5 transports only |

**Resolved 17.09.2026 — the ID clash is fixed.** The confirmation-gate question was first
written as OQ-26, but OQ-26 was already taken in PRD §11 by the master-data hierarchy
question. **The gate question is now OQ-27**; the incumbent keeps its number, because it is
the one already in the PRD register. OQ-27 has been added to that register and every
citation renumbered in the PRD, the kick-off plan, the phase plan, the pricing design note
and Q5.

---

## Two standing instructions

1. **Stop before building any quotation screen.** Mockups exist for the customer and staff
   pages and the quotation listing. They are to be supplied before Q1's pricing panel or
   Q3's listings are written. Build the API and leave the screen until they arrive.
2. **Verification is user-scheduled.** Write the tests alongside the code and leave them
   unrun. Report "implemented; verification pending" with the deferred checks named. Never
   claim an unrun check passed.
