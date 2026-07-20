# UI Page Roadmap — Fleet Management Platform

The complete, page-by-page inventory of the application UI — every landing page, dedicated page, child page, modal and reused pattern — **grouped by actor** and mapped to the **backend APIs** that power it. This is the design + build roadmap for the frontend.

| # | Document | Contents |
|---|---|---|
| — | **README** (this file) | App shell, routing/locale convention, role→landing map, cross-cutting pages, legend, current build status |
| 01 | [Page roadmap by actor](01_page-roadmap-by-actor.md) | Every page for every one of the 18 actors, with route, purpose, child views, backend APIs, phase, status |
| 02 | [Route & API matrix](02_route-and-api-matrix.md) | Master route table + page→endpoint matrix + phase + page-spec id + build status |

**Authoritative inputs** (if they disagree, the source wins): `startup-doccs/06_UX_Design_System_v2.md` (visual language, App Shell, role/scope model), `startup-doccs/07_Page_Functional_Specifications.md` (every screen's spec — A1..I2), `implementation-plan/04_Frontend_Design.md` (structure, patterns, role→nav table), `implementation-plan/03_Backend_Design.md` (module endpoints M1..M10), PRD §6 (actors). Build sequencing: [build-execution-plan.md](../build-execution-plan.md).

> **Rule from the design system:** never invent a screen. Every page below either has a Page Functional Spec entry, or must get one (using the doc's template) **before** it is built.

---

## 1. The App Shell (every authenticated page lives inside it)

One fixed shell, built once, never rebuilt per page — only the content area changes.

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER (fixed 64px)                                                     │
│ [Logo] [Scope Switcher ▾]        [🔍 Search ⌘K]   [🔔] [?] [Avatar ▾]  │
├───────────┬────────────────────────────────────────────────────────────┤
│ SIDEBAR   │ CONTENT AREA (scrolls; max-width 1280px, centred)           │
│ (role-    │  ┌ page header row: breadcrumb / title + primary action ┐   │
│  driven,  │  │  page content (the only region that varies)          │   │
│  240/72px)│  └──────────────────────────────────────────────────────┘   │
└───────────┴────────────────────────────────────────────────────────────┘
```

**Shell chrome** (shared across all roles — see §3):
- **Scope Switcher** (header) — pool/cluster/org selector generated from the user's `role_assignment` scopes; hidden for Employee. It is the access-control boundary made visible. Backed by `GET /me` + `GET /hierarchy`.
- **Global search** (⌘K) — vehicles, bookings, drivers, plates. Backed by search read models.
- **Notifications** slide-over — from the notifications service (P9).
- **Avatar menu** — profile, theme toggle (light/dark), language (EN/AR), sign out (MSAL).

## 2. Routing & locale convention

- All routes are **locale-prefixed**: `/{lang}/…` where `lang ∈ {en, ar}` (RTL for Arabic). `/` → `/en`.
- Health/probe routes are unprefixed and unauthenticated (backend only).
- Route guards: **auth** (MSAL) → **role** → **scope**. A page never queries outside the current scope+role.
- Feature routes are code-split (lazy) per screen.

> Current running prototype uses a single nav rail (`booking · handover · approvals · entitlements · console · fines · policy · executive`). The **target** is a **role-driven** sidebar generated from one role→nav-item table (below); this roadmap describes that target.

## 3. Cross-cutting / global pages (available to all or many roles)

| Page | Route | Type | Purpose | Backend | Phase | Status |
|---|---|---|---|---|---|---|
| SSO sign-in | (MSAL redirect) | auth | Microsoft Entra login; MFA for elevated roles | Entra / MSAL | P1 | planned |
| Home / role landing | `/{lang}` | landing | Redirects each actor to their default landing (see §4) | `GET /me` | P1 | 🟡 stub (home page) |
| Global search results | overlay (⌘K) | modal | Grouped results (vehicles/bookings/drivers) | search read models | P1 | planned |
| Notifications | slide-over | panel | Alerts, approvals-pending, compliance, reminders | notifications (P9) | P1 | planned |
| Profile & preferences | `/{lang}/profile` | dedicated | Theme, language, notification channel prefs | `GET /me`, prefs | P1 | planned |
| Consent Sheet | inline (booking/entitlement) | pattern | Legally-binding, non-skippable consent (EN/AR) | `POST /bookings/:id/consent` | P1 | planned |
| Not authorized (403) | error boundary | system | Role/scope denial — explains cause + next action | — | P1 | planned |
| Not found (404) | `/{lang}/*` | system | Genuine 404 under a valid locale | — | P1 | ✅ built |
| Coming soon | placeholder | system | Known nav area not yet built | — | P1 | ✅ built |
| Error boundary | route error | system | Render/network failure — retry, never blank | — | P1 | ✅ built |
| Offline / degraded banner | shell | system | Field flows: "saved locally, will sync" | sync queue | P2 | planned |
| Design system showcase | `/{lang}/design` | internal | Component/token reference (not a product page) | — | — | ✅ built |

## 4. Role → default landing page & primary nav (target model)

Each actor logs in and lands on the page most central to their job; their sidebar shows only their items, each scope-aware.

| Actor | Default landing | Primary sidebar items |
|---|---|---|
| **Employee / Driver** | `/{lang}/book` | Book a vehicle · My bookings |
| **Approver (Line Manager)** | `/{lang}/approvals` | Approvals · (delegation in profile) |
| **Delegate Approver** | `/{lang}/approvals` | Approvals (as delegator, banner shown) |
| **Fleet Manager** | `/{lang}/operations` | Operations · Handover/Return · Fleet · Fines · Reports (pool) |
| **Cluster Fleet Lead** | `/{lang}/operations` (cluster) | Operations · Fleet · Fines · Reports (cluster) · Transfers |
| **Group Fleet Lead** | `/{lang}/operations` (group) | Operations · Fleet · Reports (group) |
| **Cluster CEO** | `/{lang}/approvals` (entitlements) | Approvals · Entitlements (decide) · Reports (cluster) |
| **Executive** | `/{lang}/dashboards/executive` | Reports & dashboards (group) |
| **HR** | `/{lang}/escalations` | Escalations · Behaviour (P2) |
| **Finance** | `/{lang}/dashboards/finance` | Financial reports · Recovery |
| **Procurement** | `/{lang}/fleet` (commercial) | Vendors & leases (P2) · Fleet (commercial) |
| **Insurance Lead** | `/{lang}/fines` (accidents) | Accidents & claims · Compliance (insurance) |
| **HSE** | `/{lang}/fines` (accidents) | Accidents · Safety trends |
| **Internal Audit** | `/{lang}/audit` | Audit log · Exceptions · Decision log |
| **Data Steward** | `/{lang}/data-quality` | Data quality · Fleet (data-quality scope) |
| **System Admin** | `/{lang}/admin` | Policy engine · Org settings · Access · Integrations |
| **Professional / Substitute Driver** | `/{lang}/book` (limited) | Assigned trips · Consent (minimal) |

> **Build status of these landings:** none are role-routed yet — `/{lang}` currently shows a single generic Home to every actor and the sidebar is a fixed rail. Per-actor landing/dashboard coverage and what's still required are tracked in **§6.2**.

## 5. Legend

- **Type:** `landing` (role default) · `dedicated` (top-level feature page) · `child` (sub-page/detail within a feature) · `modal` (slide-over/dialog/wizard step) · `pattern` (reused component, not a standalone route).
- **Phase:** P1 (MVP), P2 (scale/automate), P3 (intelligence/international).
- **Status:** ✅ built · 🟡 stub/coming-soon in current app-ui · ⬜ planned.
- **API mapping:** endpoints from `03_Backend_Design` modules M1–M10; PDP = `POST /v1/decisions/evaluate` (internal), live map = Socket.IO.

## 6. Current build status (reality check) — updated 2026-07-18

### 6.1 What exists in app-ui
- **Real pages (mock-backed):** Home (a **generic** landing shown to everyone — **not** a role-based redirect), Booking (`/{lang}/booking` + booking sample), **Handover & Return** (`/{lang}/handover` — one page with a Handover/Return toggle, reusable Damage-Marker + Camera-Capture + Signature-Pad), Design-system showcase. 404 / coming-soon / error built. Running at `localhost:5199`; MSW handlers empty (booking/handover use in-component data).
- **Coming-soon stubs (no page yet):** approvals, entitlements, console, fines, policy, executive.
- **Shell built = "Wayfinder"** (navy/gold, 68px header, collapsible 264/72px sidebar, full-width content, warm hairline border, single IBM Plex Sans family). This supersedes the v2 shell sketched in §1; the page inventory, routing, API mapping and phasing below all remain valid.

### 6.2 Dedicated landing / dashboard per actor — NOT built yet
There is **no role model, no `GET /me`-driven landing redirect, no Scope Switcher, and no role-driven sidebar** yet. `/{lang}` renders the same generic Home for every user, and the sidebar is a single fixed 8-item rail (`booking · handover · approvals · entitlements · console · fines · policy · executive`) — not per-actor. Per-actor landing coverage today:

| Actor | Target landing (§4) | Current status |
|---|---|---|
| Employee / Driver | `/book` | 🟡 `/booking` page (mock) |
| Approver (Line Mgr) / Delegate | `/approvals` | ⬜ coming-soon |
| Fleet Manager | `/operations` | ⬜ (`console` stub); `/handover` built |
| Cluster / Group Fleet Lead | `/operations` (scoped) | ⬜ |
| Cluster CEO | `/approvals` (entitlements) | ⬜ (`entitlements` stub) |
| Executive | `/dashboards/executive` | ⬜ (nav item disabled) |
| HR | `/escalations` | ⬜ (no route) |
| Finance | `/dashboards/finance` | ⬜ (no route) |
| Procurement | `/fleet` (commercial) | ⬜ (no route) |
| Insurance Lead / HSE | `/fines` (accidents) | ⬜ (`fines` stub) |
| Internal Audit | `/audit` | ⬜ (no route) |
| Data Steward | `/data-quality` | ⬜ (no route) |
| System Admin | `/admin` | ⬜ (`policy` stub only) |
| Professional / Substitute Driver | `/book` (limited) | ⬜ |

**To deliver a landing/dashboard per actor, still required:** (1) a role/scope model (mock `GET /me`); (2) a `/{lang}` **role-based landing redirect** (per §4); (3) a **role-driven sidebar** generated from one role→nav table (replacing the fixed rail); (4) the landing/dashboard pages themselves — `operations`, `dashboards/executive`, `dashboards/finance`, `escalations`, `audit`, `data-quality`, `admin`, etc.

### 6.3 Route-name divergences (built prototype vs target)
The built prototype uses `booking` / `console` / `policy` / `executive` / `entitlements`; the target uses `book` / `operations` / `admin/policy` / `dashboards/executive` / `entitlements/:id`. Handover is built as **one** `/handover` page (Handover/Return toggle), whereas the target splits **Handover Queue `/handover`** + **Vehicle Handover `/handover/:bookingId`** + **Vehicle Return `/return/:bookingId`**. Reconcile route names and the handover split when these screens are built for real (or keep the consolidations with explicit sign-off).

### 6.4 Backend
Foundation only; the endpoints these pages need are **not yet implemented** (DB empty). Each page becomes real as its API slice lands — see the [build plan](../build-execution-plan.md) (contract-first vertical slices, swap MSW → real client per slice).
