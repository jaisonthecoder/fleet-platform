# Feature management implementation plan

| Document control | Value |
| --- | --- |
| Version / date | 1.0 / 13.09.2026 |
| Status | Draft implementation plan for review and approval; not implementation evidence |
| Scope | A platform-wide administration page of named switches that turn optional portal capabilities on and off without a deployment |
| Relationship to other plans | Standalone. The organisation directory, lookup management and later features each **register** switches here; none of them owns this page |
| Governing sources | PRD FG-8.1, FG-8.4, §4a.4; FR-CFG-001..008; FR-ORG-009; `09-Customer-Management-Screen-Critique.md` §2; `docs/Simplification-Register.md`; root `CLAUDE.md` rules 3, 4 and 6 |
| Owners | Platform Admin, Product, Security and Engineering; named owners to be assigned |

## 1. Purpose and outcome

Give a Platform Admin one page that lists every optional capability in the portal and lets
them turn each on or off at any time, with a reason and an audit trail, without a release.

> Every optional capability the portal gains is registered here, described in plain
> language, and controllable by an administrator - while nothing that protects tenancy,
> permissions, audit or commercial integrity is ever offered as a switch.

Two goals, and the second matters as much as the first. A switch page that accumulates
everything becomes a way to turn safety off. This plan spends as much effort on what may
**not** be a switch as on what may.

This document is a plan. Approving it does not approve every proposed switch; each switch
arrives with the feature that reads it.

## 2. Why this is separate

Feature management was first drafted inside the organisation directory plan because manual
organisation entry needed to be optional. That was the wrong home. The page is portal-wide
infrastructure: lookup management, quotations, notifications and every later feature will
register switches in it, and none of them should depend on the organisation directory
shipping first.

It is therefore its own navigation entry, its own module, its own table and its own plan.
Other plans depend on it; it depends on none of them.

## 3. The four-way boundary

The portal already has more than one thing that looks like a toggle. Deciding which kind a
new control is, before building it, is the single most useful rule in this document.

| Kind | Question it answers | Scope | Where it lives | Who changes it |
| --- | --- | --- | --- | --- |
| **Environment configuration** | Which database, which CargoWise endpoint, is the dev sign-in bypass compiled in? | One deployment | Environment and Key Vault | Release and platform engineering |
| **Platform feature switch** | May *anyone at Noatum* use this optional capability? | Whole platform | `feature_switch` - **this plan** | Platform Admin |
| **Scoped setting** | Which publication mode applies to this branch, this customer? | Platform, branch, customer, with precedence | Quotation settings, FR-CFG-001..008 under D-18 | Authorised admin per scope |
| **Customer entitlement** | May *this customer* use Quotations? | One CustomerGroup | `customer_group.flags` - already exists | Customer Success |

Three rules follow, and they are the ones to enforce in review:

1. **Anything security-sensitive to the deployment stays in the environment.** The dev
   identity bypass and the simulator-versus-real integration target are the clearest
   examples. A database row can be changed in production by anyone holding the admin page;
   an environment variable cannot. `DEV_AUTH_ENABLED` and the CargoWise endpoint therefore
   do **not** become switches, and the page must not imply that they could.
2. **If it needs a scope or a precedence rule, it is a setting, not a switch.** Publication
   mode, approval rules, claim expiry and validity all vary by branch or customer and belong
   to the D-18 settings work. A boolean with no scope is a switch; anything else is not.
3. **If it is per customer, it is an entitlement.** `customer_group.flags` already answers
   that question and is untouched by this plan.

## 4. The catalogue is code, the state is data

The list of switches is a constant in `apps/noatum-customer-portal-api/src/contracts`, not
rows an administrator can create. The table stores each switch's state only, and a stored
key absent from the constant is ignored.

Two consequences, both intended. An administrator cannot invent a switch that nothing reads
and then believe it is doing something. And a developer cannot quietly introduce one
without it appearing, described and categorised, on a reviewed page.

Each catalogue entry declares: key, category, label and description i18n keys, default
value, and whether turning it **on** requires a recorded external approval (privacy, legal
or sponsor). The effective value is the stored row where one exists, otherwise the code
default, so a fresh environment behaves predictably before anyone has opened the page.

### 4.1 Initial catalogue

Switches arrive with the feature that reads them. This is the expected Phase 1 set, not a
commitment to build the features themselves.

| Category | Key | Default | Controls |
| --- | --- | --- | --- |
| Organisation directory | `organisations.import.file` | on | The **Import file** action |
| | `organisations.import.feed` | off | The **Fetch from CargoWise** action |
| | `organisations.manual_entry` | **off** | Manual provisional organisation entry |
| | `organisations.link.require_approval` | off | Second approver on a customer link (the OQ-13 seam) |
| | `organisations.contacts.import` | off | Whether contact records are ingested at all |
| Lookup management | `lookups.type_creation` | on | Whether staff may create new lookup types |
| Access and support | `access.impersonation` | off | Read-only impersonation (FR-IAM-012) |
| Communication | `email.ai_drafting` | off | The external AI drafting service, with template fallback |
| Quotations | `quotes.instant_rate` | **off** | The instant-rate path. No rate source is configured, so this stays off until one is |

`quotes.instant_rate` is worth its own line. Root rule 1 states plainly that no rate
management exists and no source is configured. Representing that as a switch which is off
is more honest than code that assumes a price will arrive, and it gives the eventual source
a defined way to be enabled.

**A switch is enforcement, not authorisation.** Turning `organisations.contacts.import` on
does not create a legal basis for importing personal data; it stops the platform refusing
once that basis exists and has been recorded. Entries flagged as requiring external
approval prompt for the approval reference in the change drawer.

## 5. What may never become a switch

The screen critique is explicit: no toggle may disable tenancy, permissions, audit,
human-send, cost protection or accepted-version immutability. To that list this plan adds
the invariants the organisation work depends on:

- an unconfirmed organisation is never linkable;
- one organisation code belongs to one customer;
- address-level linking, which has no switch because it has no code path;
- writing anything back to CargoWise;
- the customer-visibility allow-list on documents;
- row level security, in any form.

The page renders these as a short read-only **Protected** list with the reason for each.
Saying why something is absent is more useful than leaving an administrator to wonder
whether it was overlooked - and it makes the page self-documenting for an auditor.

## 6. Behaviour

- **Effect on the next request, not the next navigation.** The screen critique flagged this
  exact error in the reference product. The server decides; the client reflects the
  decision. An open tab does not keep a disabled capability alive.
- **Enforced server-side.** Every gated route checks the switch itself. Hiding a button is
  presentation, not control. A refusal names the switch so an operator with a stale tab is
  told why rather than seeing an unexplained failure.
- **Disabling never destroys.** A switch gates an action, never data. Turning manual
  organisation entry off stops new provisional rows; the existing ones stay readable,
  reconcilable and unlinked. No switch deletes, hides or orphans a record.
- **Not retroactive.** Enabling `organisations.link.require_approval` applies to new links;
  it does not retro-void links already confirmed. Any switch whose meaning would change
  historic records is a setting with a revision, not a switch.
- **Audited with a reason.** Actor, key, before, after, reason and time, consistent with
  lookup and staff-role changes. A change without a reason is refused.

## 7. Data, API and UI

### 7.1 Storage

`feature_switch`: `key` (primary key, must exist in the catalogue), `is_enabled`,
`approval_reference`, `updated_by_user_id`, `updated_at`, `reason`. Internal-only RLS, as
for `role`, `permission`, `region` and `branch`. No tenant column: these are platform-wide
by definition.

Effective values are read per request through a small service with no cache in Phase 1,
consistent with simplification A1. Add a cache behind that service only when a measured p95
asks for one.

### 7.2 API

| Route | Permission |
| --- | --- |
| `GET /v1/admin/feature-switches` (catalogue plus effective state, grouped) | `admin.flags.manage` |
| `PATCH /v1/admin/feature-switches/:key` | `admin.flags.manage` |

`admin.flags.manage` already exists in `contracts/permissions.ts` and is held by
`platform_admin`. No new permission code is required.

These routes are themselves never switch-gated. A switch able to disable the page that
controls the switches would be a lock with the key inside.

### 7.3 A guard, not a scattering of `if` statements

A `@RequireFeature('organisations.manual_entry')` decorator alongside the existing
`@RequirePermission`, backed by a guard that reads the effective value. Permission and
switch are independent and both must pass. Putting it in a decorator keeps the check
declarative, greppable and impossible to forget halfway down a service method.

### 7.4 User interface

A distinct navigation entry: **Administration > Feature management**, beside Lookup
management rather than inside any feature. Built from existing design-system components at
the administration density already used by lookup management; tokens only.

- Switches grouped by category, each row showing name, plain-language description, effective
  state, and who last changed it and when.
- Changing one opens the standard right-hand drawer: new value, reason, and an approval
  reference where the catalogue requires it. The drawer states the consequence in plain
  words before saving.
- A **Protected** section beneath, read-only, listing the invariants and why each is not a
  switch.
- Search and a category filter, since this list grows with every feature.
- Loading, empty, error and permission-denied states as standard.

## 8. The convention this creates

The lasting value is not the page; it is the habit. Proposed addition to the repository
Definition of Done:

> When a task adds an **optional** capability - one the business might reasonably want off -
> register a switch in the catalogue, gate the route with `@RequireFeature`, and add its
> label and description in EN and ES. If the capability is not optional, say so in the pull
> request and add it to the Protected list instead.

That forces the question *"should an administrator be able to turn this off?"* to be
answered deliberately for every feature, which is what the request behind this plan actually
asks for. Without it the catalogue silently stops reflecting the product.

## 9. Work packages

| Package | Work | Depends on | Exit evidence |
| --- | --- | --- | --- |
| **FM-01** Catalogue and storage | Catalogue constant, `feature_switch` migration with RLS and grants, effective-value service | - | Migration reversible; internal-only RLS proven; unknown stored key ignored; defaults apply on a fresh database |
| **FM-02** Guard and API | `@RequireFeature` guard, both routes, DTOs, OpenAPI | FM-01 | Gated route refused server-side when off, with the switch named; permission and switch independent; 403 test per route |
| **FM-03** Administration page | Grouped list, change drawer with reason, Protected list, EN and ES | FM-02 | Change takes effect on the next request with a tab open; audit row complete; axe pass; disabled states explain themselves |
| **FM-04** Adoption | Register the Phase 1 catalogue against features as they land; add the Definition of Done clause | FM-03 | Each registered switch demonstrably gates its capability; no capability gated by an ad-hoc `if` |

FM-01 to FM-03 are small and depend on nothing outside themselves, which is the argument
for building them before the organisation directory rather than alongside it.

## 10. Test matrix

| ID | Check | Expected |
| --- | --- | --- |
| FM-T01 | Switch off, permission held | Gated endpoint refused server-side with a reason naming the switch |
| FM-T02 | Toggled with a tab open | Next request obeys the new value; no reload or re-login |
| FM-T03 | Disabling after use | Records created while on remain readable and intact; nothing deleted or hidden |
| FM-T04 | Unknown stored key | Ignored; never offered on the page |
| FM-T05 | Protected invariants | No switch exists for any listed invariant; the page shows them read-only with reasons |
| FM-T06 | Audit and reason | Actor, key, before, after, reason and time recorded; a change without a reason is refused |
| FM-T07 | Permission | Without `admin.flags.manage`, neither read nor change; the routes are not switch-gated |
| FM-T08 | Not retroactive | Enabling an approval switch affects new work only; historic records unchanged |
| FM-T09 | Impersonation | An impersonated session cannot change a switch |
| FM-T10 | Fresh database | Every switch reports its code default before any row exists |
| FM-T11 | Approval-required switch | Turning it on without an approval reference is refused |
| FM-T12 | Boundary | No environment-level control (dev bypass, integration target) appears as a switch |

FM-T12 earns its place. It is the regression test for the mistake this page makes easy: the
day somebody decides the simulator toggle would be convenient here.

## 11. Decision gates

| ID | Decision | Owner | Blocks |
| --- | --- | --- | --- |
| **FM-D01** | Confirm the initial catalogue and each default, particularly `access.impersonation` and `quotes.instant_rate` | Product + Security | FM-01 |
| **FM-D02** | Confirm the Protected list is complete, and that nothing on it is expected to be configurable later | Security | FM-01 |
| **FM-D03** | Which switches require an external approval reference before being turned on | Product + Privacy | FM-03 |
| **FM-D04** | Accept the Definition of Done clause in section 8 | Engineering + Product | FM-04 |
| **FM-D05** | Whether `admin.flags.manage` covers both platform switches and customer entitlements, or the two should separate | Security | FM-02 |

FM-D05 is worth a moment. The same permission currently governs a per-customer entitlement
and a platform-wide capability. Those are different blast radii, and a Customer Success user
who may enable a feature for one customer probably should not be able to disable manual
organisation entry for everybody.

## 12. Release and rollback

- Switch states are **reviewed and recorded as part of each release**, not inherited from
  whatever the last environment held. A production release states which capabilities are on
  and who approved each.
- The Protected list is re-checked at release; a new invariant that gained a switch by
  accident is a release blocker.
- A switch is the fastest rollback available for an optional capability: turning one off
  stops the action immediately, everywhere, on the next request, without a deployment and
  without touching data. Prefer it to a hotfix when a capability misbehaves.
- Rollback of the page itself is forward-only. Dropping `feature_switch` returns every
  capability to its code default, which for the current catalogue is the safe direction -
  but confirm that remains true before relying on it.

**Completion criterion:** a Platform Admin can see every optional capability the portal has,
understand in plain language what each does, turn any of them on or off with a reason and an
audit trail that takes effect on the next request - and cannot, from that page, weaken
tenancy, permissions, audit or any other invariant.
