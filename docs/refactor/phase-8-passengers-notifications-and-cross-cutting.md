# Phase 8 — Passengers, Notifications & Cross-Cutting

**Goal:** Close the remaining real-world gaps: capture passenger identities (not just a count), give users an in-app notification inbox with proactive expiry reminders and approval outcomes, and add an admin-configurable reason catalog so block messages can be tuned without a deploy.

**Scenarios:** S-07, S-23, S-52, S-64, S-66, S-72, S-74, S-84
**Features:** F-80, F-81, F-82, F-83, F-84, F-52, F-53

---

## In scope
- Passenger identities + capacity validation; in-app notification inbox + expiry reminders + approval notifications; reason catalog with admin authoring.

## Out of scope
- SMS/push transport changes (the notification port already abstracts channels); analytics dashboards beyond basic counts.

## DB
- Migrations: `fleet.booking_passenger`, `fleet.notification_inbox`, `fleet.reason_message` (§03 1.4–1.5, 1.7). Rollbacks drop each.

## Backend
- **Passengers:** `POST /v1/bookings/:id/passengers` (list of employee picks/guests); validate `passengers.length === passengerCount`; keep capacity gate. Expose on booking read models (privacy-minimized).
- **Notifications:** persist to `notification_inbox` alongside `NotificationService.deliver`; `GET /v1/me/notifications`, `POST /v1/me/notifications/:id/read`. Add a cron worker for **expiry reminders** (licence/EID/medical/vehicle docs approaching expiry → `compliance` category, unmutable) and emit **approval-outcome** notifications from booking/dedicated decisions.
- **Reason catalog:** `GET /v1/reasons/:code` resolves the effective message (catalog overlay over i18n defaults, scope-aware); admin CRUD `/v1/admin/reasons`. Wire hard-block + policy reason codes through the resolver so admins can edit copy (copy-only; never logic).

## Frontend
- **Passenger capture:** when `passengerCount > 1`, reveal a passenger list (employee search via directory or guest name/phone); validate count.
- **Notification inbox:** wire the header bell to a real inbox (list, unread count, mark-read); currently decorative.
- **Reason admin:** simple screen to edit reason messages (title/body/severity/guidance link) per code/scope.

## Contracts / guards
- New DTOs → `guard:contracts:update`; org-scoped files → `guard:org` allowlist.

## Tests
- BE: passenger count validation; notification inbox read/unread; expiry-reminder worker selects the right records; reason resolver overlay + fallback.
- FE: passenger picker; notification bell/inbox; reason admin edit reflects in a block message.

## Acceptance criteria
- Selecting N (>1) passengers captures N identities; capacity still gates.
- Users receive and can read in-app expiry reminders and approval outcomes; compliance reminders are unmutable.
- An admin can change a block message's copy (and link a help article) without a deploy; hard-block **logic** remains code-owned.

## Dependencies
P1 (reasons), P2 (documents for expiry reminders), P7 (help links). Uses existing `NotificationService`/port.
