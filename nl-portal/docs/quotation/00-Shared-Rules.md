# Shared rules for every quotation phase

Read once, then apply to Q0 through Q5. Nothing in an individual phase file repeats these.

---

## 1. The context you must not forget

The organisation has **no rate database, no centralized rate storage, no standardized
format and no standardised quoting process.** Confirmed at director level on 17.09.2026,
while the system landscape is being redesigned.

> **If the business has not decided it, do not model it. Store it loosely, keep a seam,
> and move on.**

If a design choice requires a standard that does not exist, the choice is wrong. A quote
answer is **one or more priced options, or an attached document, or both, plus free text** —
recorded by a person, or received from CargoWise.

**A person types every option.** Nothing derives, compares or ranks them. The cap forbids
*computing* a price, not offering a choice.

Second rule, which decides the ordering:

> **Build the half that survives the landscape redesign first.** Request capture, the
> portal record and the customer-facing response outlive any pricing system. Anything
> shaped to a specific TMS does not.

---

## 2. Working method

1. **Plan mode first.** List the files you will create or change, the schema changes, the
   new permission and switch keys, and the tests. Wait for approval.
2. Build in the order **migration → contracts → API + tests → OpenAPI → UI**. Never start
   with the screen.
3. Stay inside the phase. Work discovered outside it goes to `docs/gaps.md` or becomes a
   proposed phase. Never silently.
4. Small commits, prefixed with the phase: `Q1: record a price`.
5. **A commit spans two repositories.** Commit and push inside `apps/<app>`, then
   `git add apps/<app>` and commit the moved pointer in the parent.

---

## 3. Non-negotiable, every file

1. **Tenancy in the data layer.** New tables are Pattern A: `customer_group_id NOT NULL`,
   indexed, RLS enabled and forced. Reversible migration with a `down.sql`. Never accept
   `customer_group_id` from the client. Never filter tenants in React.
2. **`@RequirePermission('<code>')` on every route**, with the code seeded.
3. **Feature-gated routes fail closed** — 403 from the guard. Hiding a button is not a
   control.
3a. **Every optional capability gets a switch, including a variation of one.** Whole modules
   and shapes alike: `quotations.portal_pricing` governs whether the portal may price at all,
   `quotations.multi_option` governs whether a quote may carry more than one option. The
   catalogue is code, the state is data. A switch changes behaviour and presentation, **never
   the schema** — and never retracts what a customer has already been shown.
4. **Provenance on anything not typed by the person in front of you**, overridable by a
   human with a mandatory reason, keeping the original.
5. **No external call inline.** Jobs only, enqueued in the same business transaction. The
   one standing exception is `RateEngineAdapter`, which stays untouched and unused.
6. **Design tokens only.** No hex colour, `font-family` or `border-radius` outside
   `src/design-system`.
7. **EN and ES strings through i18next. Dates `DD.MM.YYYY`. No emoji, no exclamation
   marks.** Money shows a currency code, never a bare symbol.
8. **Loading, empty and error states on every data view. WCAG 2.1 AA.**
9. **`AuditEvent` on significant writes, `AnalyticsEvent` on user actions.**
10. **Server-side pagination.** List endpoints under 2 s at 100k rows per group.
11. **Regenerate OpenAPI.** The SPA client is generated, never hand-written.

---

## 4. Do not build, under any circumstances, without asking

Rate tables · rate or tariff storage · charge-code mapping for quotes · an approval
workflow · cost or margin modelling · a pricing queue **screen** · automatic
carrier comparison · anything that assumes a price arrives automatically.

**Claim and release are IN scope, in Q1.** They were moved out of this list on 17.09.2026:
ownership of a request must be visible whether or not CargoWise is connected. Only the queue
*screen* around them is deferred.

Each was excluded on director-level evidence, not by oversight. The seam for each:

| Not built | Seam kept | Reinstated when |
| --- | --- | --- |
| Rate or tariff tables | None needed | A rate source exists. Nothing to migrate |
| Automatic instant pricing | `RateEngineAdapter` + `quotations.instant_rate`, off | A source is configured. No code change |
| Pricing queue **screen** — branch-scoped worklist, filters, assignment, SLA timers | Claim and release exist on the quote itself (Q1); internal users already carry a branch | Volume justifies a dedicated worklist |
| Charge codes and a line schema | `priceLines` Json, free-form | A standard format is published |
| Approval workflow and threshold | **Answered by the mockup.** `approval` on, `threshold` EUR 10,000, scoped | — |
| Cost and margin | **Answered by the mockup.** Charge-line cost and margin behind `costCapture`, default off | — |
| **Automatic** carrier comparison or ranking | Options exist, but a person types each one | A rate source exists |
| AI-drafted customer email | Interface with a template fallback | The other team ships it (OQ-25) |
| Carrier comparison as a rate lookup | Carrier is free text on an option | A rate source exists |

**Decision 17.09.2026 — multiple priced options are IN scope.** Offering a customer two or
three choices is ordinary forwarding practice, not process machinery, so it is not on the
list above. What stays excluded is anything that *derives* those options automatically: no
rate lookup, no carrier comparison engine, no ranking. A person types each option.

---

## 5. Verification policy

**Verification in this repository is user-scheduled.** Do not run tests, typechecking,
linting, formatters or verification-only builds unless the user asks in that turn.
Finishing a phase is not permission. Do not route them through a subagent or a script
either.

Write the tests. Leave them unrun. Report **"implemented; verification pending"** with the
deferred checks and the risks you know about.

---

## 6. Traps in this repository, learned the hard way

- The path alias `@/contracts` works for `import type` **only**. Value imports must be
  relative, or the CommonJS build fails at runtime with `Cannot find module '@/contracts'`.
- `get_errors` is not trustworthy immediately after an edit. Grep the file for what should
  now exist, or compile.
- Git-checked-out files are CRLF; newly written files are LF. A scripted replace whose
  anchor contains `\n` matches nothing **and still reports success.** Verify the file, not
  the script output.
- **Never rewrite a source file from PowerShell.** Windows PowerShell 5.1 writes the ANSI
  code page and corrupts every accented character.
- `ALTER TYPE ... ADD VALUE` cannot be used in the transaction that adds it, and Prisma
  wraps each migration in one. Adding an enum value and using it are **two migrations**.
- Swagger needs a DTO **class** for a request body. `@Body() body: unknown` emits no
  `requestBody` and the generated client types it `never`.
- A `DELETE` with a request body does not survive the OpenAPI contract. Use `POST`.
- Radix `Select` reserves the empty string. Use a named sentinel, never `value=""`.
