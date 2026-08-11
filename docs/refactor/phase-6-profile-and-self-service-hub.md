# Phase 6 — Profile & Self-Service Hub

**Goal:** A dedicated profile page where a user sees, in one place, their eligibility, credentials & documents, bookings, requests with approval/rejection decisions and reasons, and any current issues/blocks with remediation links.

**Scenarios:** S-60, S-61, S-62, S-63, S-64, S-65, S-66
**Features:** F-60, F-61, F-62, F-63, F-64, F-65

---

## In scope
- Profile hub page `/:lang/profile` with tabs/sections; aggregate read; self-service credential/document management (reusing P2 panel); wire the header "Profile" menu item (currently a label with no route).

## Out of scope
- Editing other people's profiles (admin path stays in access-management).

## Backend
- Aggregate read `GET /v1/me/overview` composing existing data: credentials (P1), documents (P2), my bookings (`myBookings`), my requests + decisions (booking + dedicated worklists filtered to the requester), and computed `blockers[]` with remediation kind.
- Reuse existing endpoints where possible; the aggregate is a read-only convenience projection (no new writes).

## Frontend
- New `ProfilePage` at `/:lang/profile`, reachable from the header profile menu.
- Sections:
  - **Eligibility summary** — "What would block me now" (from `blockers[]`), each with a fix link.
  - **Credentials & documents** — licence/EID status + source/verification; upload/replace via the P2 `PersonDocuments` panel.
  - **My bookings** — active/upcoming/past with statuses (reuse `myBookings`).
  - **My requests & decisions** — dedicated + booking requests with approver decisions and **reasons** (reuse worklist/approvals read models scoped to self).
  - **Issues/blocks** — consolidated blockers with remediation CTAs (to capture or help).
- Add profile route + nav wiring; breadcrumb "Home › Profile".

## Contracts / guards
- `MeOverviewDto` → `guard:contracts:update`.

## Tests
- BE: `/me/overview` composition + scoping (only self data).
- FE: profile renders all sections; blockers show fix links; documents panel works; my-bookings/decisions render; RTL/a11y.

## Acceptance criteria
- A user can open their profile and immediately understand their eligibility, fix missing credentials, and review their bookings and decision history with reasons.
- The header "Profile" menu navigates to the page (no longer a dead label).

## Dependencies
P1, P2, P4, P5 (data sources). Complements P7 (help links).
