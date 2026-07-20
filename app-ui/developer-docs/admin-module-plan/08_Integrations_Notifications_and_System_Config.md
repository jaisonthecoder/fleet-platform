# Phase 08 — Integrations, Notifications, System Config & Admin Home

> **Backend readiness: 🟠 needs backend** for most surfaces (integration health, notification config,
> feature flags, admin-home aggregates). `GET /me` and a future health/config surface back it. This phase
> is specified in full so the backend lane can build the small config endpoints; the UI ships **read-only
> status + config-mock-first** slices behind capability flags.
>
> **Owner:** `SystemAdmin`. **Routes:** `/{lang}/admin` (home), `/{lang}/admin/integrations`,
> `/{lang}/admin/notifications`. **Specs:** I2, P6, P9.

---

## 1. Business context

The System Admin's "control tower": a landing that shows platform health + connection status, the
**integrations** panel (IdP/HCM/M365/telematics/tolls), and **notification configuration** (20 triggers,
channels, and the **unmutable compliance floor** — compliance alerts can never be muted, mirroring the
backend `NotificationService.isSuppressible` rule). Plus system settings / feature flags.

**Guardrails:**
- **Compliance notifications are unmutable** — the UI must render them as locked (cannot disable), matching
  the backend invariant. Never offer an affordance the backend will reject.
- Integration secrets are **never displayed** — status + last-sync + "configured/not-configured" only.
- Feature flags gate *UI capability*, not security.

---

## 2. Backend surface

| Method | Path | Status | Purpose |
|---|---|---|---|
| GET | `/api/v1/me` | ✅ live | Identity for the home header |
| GET | `/api/v1/health/ready` | ✅ live | DB/Redis readiness (platform health tile) |
| GET | `/api/v1/admin/integrations` | 🟠 **enhancement** | IdP/HCM/M365/telematics/tolls status + last-sync |
| POST | `/api/v1/admin/integrations/hcm/sync` | 🟠 **enhancement** | Trigger `HcmSyncService.sync()` (exists) |
| GET/PUT | `/api/v1/admin/notifications/config` | 🟠 **enhancement** | Triggers × channels matrix (+ locked compliance) |
| GET/PUT | `/api/v1/admin/settings` (feature flags) | 🟠 **enhancement** | System settings / flags |

---

## 3. Screen design

### `/admin` — Admin Home (`pages/admin-home-page.tsx`)
- **Welcome header** from `me` (name, roles, active scope).
- **Health tiles:** platform readiness (`/health/ready` — DB/Redis up), and (enhancement) integration
  status summary (green/amber/red per integration) using `StatCard` + `StatusChip`.
- **Quick links** to each admin area (reference data, access, org, policy, integrations, notifications,
  data quality, audit) — a role-filtered launcher (reuses `navFor(me)`).
- **Recent governance activity** (enhancement) — last N audit entries (reuses the audit table, read-only).

### `/admin/integrations` — Integrations (`pages/integrations-page.tsx`)
- `ResourceTable`/card grid of integrations: IdP (Entra), HCM (Oracle Fusion), M365/email, Telematics
  vendor, Tolls (Salik/Darb). Each: status chip (Connected/Degraded/Not configured), **last sync**,
  **freshness** (mirrors HCM freshness SLA — stale ⇒ amber), and a **Sync now** action for HCM
  (`POST …/hcm/sync`, exists server-side). **No secrets shown.**
- Detail drawer per integration: config summary (non-secret), recent sync outcomes.

### `/admin/notifications` — Notification config (`pages/notifications-page.tsx`)
- **Triggers × channels matrix** (`ResourceTable` or a matrix grid): rows = the ~20 triggers grouped by
  category (compliance / booking / approvals / fines / …), columns = channels (email / push / SMS / in-app).
  Toggle a channel per trigger. **Compliance-category rows are locked ON** (unmutable) with a lock icon +
  tooltip explaining the policy floor. Save = PUT config (enhancement).

---

## 4. Reusable components used / created

| Component | Source | Notes |
|---|---|---|
| `AdminPageLayout`, `ResourceTable`, `StatCard`, `DetailDrawer`, `StatusChip`, charts | shared kit | reused |
| `HealthTile` | **new shared** | up/down/degraded status tile (reused on any ops/home surface) |
| `FreshnessBadge` | **new shared** | last-sync age vs SLA (reused by compliance/eligibility later) |
| `ToggleMatrix` | **new shared** | rows × columns toggle grid with locked cells (reused for any capability/permission matrix) |
| `LauncherGrid` | **new shared** | role-filtered quick-links (reused by other role home pages) |

---

## 5. RBAC & governance

- Routes `RequireRole roles={['SystemAdmin']}`.
- Sync/config writes confirm + toast; audited server-side.
- Locked compliance notifications: render disabled + explained (never a rejected toggle).

---

## 6. i18n keys (`admin.home.*`, `admin.integrations.*`, `admin.notifications.*`)

```
home.welcome, home.health, home.quickLinks, home.recentActivity,
integrations.col.name|status|lastSync|actions, integrations.syncNow, integrations.notConfigured,
integrations.<idp|hcm|m365|telematics|tolls>, status.connected|degraded|notConfigured,
notifications.trigger, notifications.channel.email|push|sms|inApp, notifications.locked, notifications.save
```

---

## 7. Tests

- `admin-home-page.test.tsx` — header from `me`; health tile from `/health/ready`; role-filtered launcher.
- `integrations-page.test.tsx` — status list (mock endpoint); HCM sync action calls POST; freshness badge.
- `notifications-page.test.tsx` — matrix toggles; compliance rows locked + not togglable; save PUT.
- `toggle-matrix.test.tsx`, `health-tile.test.tsx`, `freshness-badge.test.tsx` (shared).

**MSW:** `/me`, `/health/ready` (live-shaped), and mock `/admin/integrations`, `/admin/notifications/config`.

---

## 8. Backend / DB change register (proposed)

1. **`GET /admin/integrations`** — aggregate connection status + last-sync + freshness for IdP/HCM/M365/
   telematics/tolls (no secrets). **Medium.**
2. **`POST /admin/integrations/hcm/sync`** — expose the existing `HcmSyncService.sync()` with `@Roles`. **Low.**
3. **Notification config store** — `GET/PUT /admin/notifications/config` (triggers × channels), enforcing
   the **unmutable compliance** invariant server-side (UI mirrors it). **Medium.**
4. **System settings / feature flags** — `GET/PUT /admin/settings`. **Medium.**
5. **Admin-home aggregates** — a light `GET /admin/overview` (health + integration summary + recent
   activity counts) to avoid many calls. **Low–medium.**

Until these land, Admin Home ships with live **health + role launcher**; Integrations/Notifications ship
behind `capabilities.*` flags (read-only/mock) so the routes exist without broken screens.

---

## 9. Exit checklist

- [ ] Admin Home: `me` header + live health tile + role-filtered launcher (backed today).
- [ ] Integrations + Notifications screens built behind capability flags; wired when endpoints land.
- [ ] Compliance notifications rendered **locked/unmutable** (matches backend invariant).
- [ ] `HealthTile`, `FreshnessBadge`, `ToggleMatrix`, `LauncherGrid` added to shared kit + tested.
- [ ] RBAC guard; i18n EN/AR; RTL verified.
- [ ] Backend items filed in register (file 10).
- [ ] Gate green.
