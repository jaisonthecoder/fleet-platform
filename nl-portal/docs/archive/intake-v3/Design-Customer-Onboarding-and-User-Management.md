# Application Design — Customer Onboarding and User Management

| | |
|---|---|
| **Scope** | How a customer company is onboarded to the portal, how its users are created, log in, get roles, and are removed — end to end, from the application's point of view |
| **PRD items** | FG-8.1 Customer administration · FG-8.2 Customer self-service admin · FG-8.4 Role management · FG-10 Identity · §5 master data · §6 data model · §7 security |
| **Related notes** | `KB-CW1-Integration-Multi-Tenant.md` (org-code mapping and tenant resolution) · `01-Vertical-Slice-Implementation-Plan.md` (S1.02, S1.03, S1.07, S1.12) |
| **Written** | 03.09.2026 · v2 04.09.2026 · **v3 04.09.2026** — simplified: Entra handles all login and MFA (no local accounts, no SSO code of ours), linking an org code is one audited action (4-eyes is a column-level seam), impersonation always read-only, no role designer. Where this document and LLD v3 differ, LLD v3 wins. |
| **Audience** | Development team — plain English |

---

## 1. Principles

1. **No self-registration.** A customer exists in the portal only because Noatum created it from a CargoWise relationship. Users exist only because someone with the right permission invited them.
2. **Noatum onboards the company; the customer onboards its people.** After the first Customer Admin is invited, Noatum is out of the customer's daily user management.
3. **Identity and authorisation are separate.** *Who you are* comes from the identity provider (Entra External ID, customer SSO, or local account with MFA). *What you may do* comes from our roles and permissions. Never mix them.
4. **Every user belongs to exactly one CustomerGroup** (or is internal Noatum staff with no group). The group is set at invitation and cannot be changed by the user.
5. **Every admin action is audited.** We propose that the security-critical one (org-code mapping) needs a second person to approve. This 4-eyes step is **not in the PRD** and is pending sign-off (ADR-003); if declined it becomes a single-person confirm dialog, still audited.
6. **Server-side enforcement only.** The UI hides what you cannot do; the API refuses it. Both, always.

## 2. Actors

| Actor | Where they work | What they can do in this area |
|---|---|---|
| **Noatum Platform Admin** | Noatum Admin workspace | Everything below, plus role designer, feature flags, impersonation |
| **Noatum Customer Success** | Noatum Admin workspace | Create groups, link org codes (request), invite first Customer Admin, view usage |
| **Noatum Approver** (any second admin) | Noatum Admin workspace | Approve org-code mapping requests they did not raise |
| **Customer Admin** | Customer portal → Administration | Invite, deactivate, re-invite users in own group; assign predefined roles; manage notification recipients; view own group's audit |
| **Customer user** | Customer portal | Manage own profile, locale, notification preferences, MFA device |

## 3. Roles and permissions

### 3.1 Predefined customer roles (seeded, global, read-only for customers)

| Role | Permissions (codes) | Typical person |
|---|---|---|
| **Standard** | `tt.view`, `docs.view`, `notifications.manage_own`, `profile.manage_own` | Anyone who needs to see where cargo is |
| **Quoting & Booking** | Standard + `quote.create`, `quote.submit`, `quote.accept`, `booking.create`, `booking.submit`, `booking.cancel`, `addressbook.manage`, `templates.manage` | Logistics / commercial staff |
| **Finance** | Standard + `finance.view`, `reports.spend` | Accounts payable |
| **Analyst** | Standard + `reports.view`, `reports.selfservice`, `reports.schedule` | Supply-chain analyst |
| **Claims** | Standard + `claims.create`, `claims.comment` | Whoever handles incidents |
| **Customer Admin** | Standard + `admin.users`, `admin.roles.assign`, `admin.reports.assign`, `admin.recipients`, `admin.audit.view`, `addressbook.delete` | Customer's logistics manager |

A user may hold several roles; effective permissions are the union.

### 3.2 Internal Noatum roles

| Role | Adds |
|---|---|
| **Customer Success** | `platform.groups.manage`, `platform.accounts.request`, `platform.invite_admin`, `platform.usage.view` |
| **Platform Approver** | `platform.accounts.approve` |
| **Platform Admin** | all above + `platform.roles.design`, `platform.flags.manage`, `platform.impersonate`, `platform.news.publish` |

### 3.3 Sub-permissions (PRD FG-8.4 examples)

The permission model gives these for free by splitting codes: `quote.create` without `quote.submit` = "prepare but not send"; `booking.create` + `booking.submit` without `booking.cancel`; `addressbook.manage` without `addressbook.delete`. The role designer (Platform Admin) can create custom roles per group from any combination.

### 3.4 Rules

- Permission codes are constants in `packages/shared-types/permissions.ts`; every route declares one with `@RequirePermission()`.
- A Customer Admin can assign only the predefined customer roles and custom roles created for their group — never internal roles.
- A Customer Admin cannot remove the last Customer Admin of the group (server check).
- Permissions are cached for 60 seconds and the access token carries a `role_version`; any role change bumps the version so the next request reloads permissions. A revoked role therefore takes effect on the next request, without re-login.
- **Report access** (PRD FG-8.2, P0): Customer Admins also grant users access to the standard reports Noatum has assigned to the group (`admin.reports.assign`). The table (`report_assignment`) arrives with reports in Phase 2; the permission and screen placeholder exist from Phase 1.

## 4. Data model

```
customer_group ──< customer_account          (org codes, see KB-CW1 note)
customer_group ──< user ──< user_role >── role ──< role_permission >── permission
customer_group ──< user_invitation
customer_group ──< custom role (role.customer_group_id not null)
user ──< user_identity                       (one row per IdP link)
user ──< mfa_device
user ──< user_session
impersonation_session (admin_user_id, target_user_id)
audit_event
```

### 4.1 Tables

**customer_group**

| Column | Notes |
|---|---|
| id, parent_id nullable | hierarchy |
| name, legal_name, country_iso | |
| tier | sme / large / vip (OQ-10) |
| feature_flags jsonb | documents, financials, predictive, market_insights, po_visibility, premium_alerts … |
| email_domains text[] | e.g. `acme.com`; used to validate invitations and notification recipients |
| identity_mode | `entra_external` (default), `customer_sso` (Phase 2 federation), `local_mfa` |
| login_slug | per-customer login URL for `local_mfa` groups, so the login page never reveals which domains use local accounts |
| sso_config jsonb nullable | tenant id / metadata URL when `customer_sso` |
| status | onboarding / active / suspended / closed |
| created_by, created_at, updated_at | |

**customer_account** — see KB-CW1 note (org code, branch, country, status, approval columns).

**user**

| Column | Notes |
|---|---|
| id | |
| customer_group_id nullable | null = internal Noatum user |
| email (unique, lower-cased) | |
| display_name, job_title, phone | |
| locale | en-US / es |
| is_internal bool | |
| status | invited / active / deactivated / locked |
| last_login_at, login_count | for FG-8.6 analytics |
| notification_prefs jsonb | |
| created_at, updated_at, deactivated_at, deactivated_by | |

**user_identity**

| Column | Notes |
|---|---|
| user_id | |
| provider | entra_external / entra_internal / saml:<group> / local |
| subject | IdP's stable id (oid / NameID) |
| linked_at | |
| unique (provider, subject) | |

**mfa_device** (local accounts only): user_id, type totp / sms, secret_ref (Key Vault), verified_at, last_used_at.

**user_invitation**

| Column | Notes |
|---|---|
| id, customer_group_id | |
| email | must match `email_domains` unless override flag set by Noatum |
| role_ids uuid[] | roles to grant on acceptance |
| token_hash | never store the raw token |
| invited_by, invited_at | |
| expires_at | default 7 days |
| status | pending / accepted / expired / revoked |
| accepted_at, accepted_user_id | |
| resend_count | max 3 |

**role**: id, customer_group_id nullable (null = global preset), name, description, is_internal, is_preset.
**permission**: code, description, area.
**role_permission**: role_id, permission_code.
**user_role**: user_id, role_id, granted_by, granted_at.

**impersonation_session**: id, admin_user_id, target_user_id, reason (mandatory), started_at, ended_at, ip.

**user_session**: id, user_id, created_at, last_seen_at, ip, user_agent, revoked_at — lets an admin sign a user out everywhere.

**audit_event**: id, actor_user_id, actor_impersonating_id nullable, customer_group_id nullable, action, entity_type, entity_id, before jsonb, after jsonb, ip, created_at. Audit rows are append-only.

## 5. Flows

### 5.1 Flow A — Noatum onboards a company

| # | Step | Actor | System behaviour |
|---|---|---|---|
| 1 | Open "New customer group" | Customer Success | Form: name, legal name, country, tier, identity mode, email domains |
| 2 | Save | | `customer_group` created with status `onboarding`; feature flags default from tier; `AuditEvent group.created` |
| 3 | Search CargoWise organisations | | Type-ahead over `master_org_code` (mirror of CW1 orgs from the master-data import) |
| 4 | Add org codes to the group | | Creates `mapping_change_request(kind=add_account)` per code — **not** an account yet |
| 5 | Second admin approves (**proposed 4-eyes, pending sign-off**) | Platform Approver | Requester ≠ approver enforced; `customer_account` rows created with `status=active`; re-evaluation job resolves historical shipments; `AuditEvent account.mapped` |
| 6 | Optional: set parent group | Customer Success | Two levels only (parent → children), as PRD FG-8.1 states; children computed at login |
| 7 | Invite first Customer Admin | Customer Success | Enters name + email; `user_invitation` with `role_ids=[Customer Admin]`; branded email sent by worker |
| 8 | Group becomes `active` | system | When at least one account is approved and one Customer Admin has accepted |

Screen: **Noatum Admin → Customers → [group] → tabs: Overview · Accounts (org codes) · Users · Feature flags · Hierarchy · Audit**.

### 5.2 Flow B — Invitation accepted (first login)

| # | Step | System behaviour |
|---|---|---|
| 1 | User clicks link in email | `GET /invitations/:token` — validates hash, expiry, status; shows the group name and inviter (no other data) |
| 2 | Identity step | Depends on `identity_mode`: <br>• `entra_external` → redirect to Entra External ID sign-up/sign-in; on return, `subject` is linked <br>• `customer_sso` → redirect to the group's SAML/OIDC IdP; email in assertion must equal invitation email <br>• `local_mfa` → set password (policy enforced) → enrol TOTP → verify code |
| 3 | Accept | `POST /invitations/:token/accept` in one transaction: create `user` (status active), `user_identity`, `user_role` rows from `role_ids`, mark invitation accepted, `AuditEvent user.created` |
| 4 | Land on dashboard | Locale from browser or invitation; welcome banner from News tool; training walkthrough (P4) |

Rules: a token is single-use; an expired token shows "ask your administrator to re-invite"; the email on the invitation must match the identity's email claim (case-insensitive) or acceptance is refused.

### 5.3 Flow C — Customer Admin invites colleagues

| # | Step | System behaviour |
|---|---|---|
| 1 | Administration → Users → Invite | Form: email(s), display name, roles (multi-select from allowed roles), optional message |
| 2 | Validate | Email domain must be in `customer_group.email_domains` (Customer Admin cannot override; Noatum can); not already a user; invitation limit per day (anti-abuse) |
| 3 | Send | `user_invitation` created, email queued, `AuditEvent invitation.sent` |
| 4 | Track | Users list shows Invited / Active / Deactivated; actions: resend (max 3), revoke |

Bulk invitation by CSV is **deferred** (not in PRD; gaps.md). Phase 1 supports single invitations only.

### 5.4 Flow D — Login (returning user)

1. `/login` shows the design-system Tabs ("Customer Area"). User enters email.
2. The portal always redirects to Microsoft Entra External ID (which handles federation to a customer's own IdP for `customer_sso` groups). Customers on local accounts use their per-customer login page `/login/<slug>` given at onboarding, so the shared login page never reveals which companies are customers or which use local accounts.
3. On success: `user_identity` matched by (provider, subject) — never by email alone after first link; `user.status` must be `active`; session created; `last_login_at` updated; `AnalyticsEvent login`.
4. Tenant context for the request pipeline: `customer_group_id`, descendants (for hierarchy), `is_internal`, permission set.
5. Failure paths: deactivated → "account disabled, contact your administrator"; locked after N failed local attempts → unlock by Customer Admin or timed.

Session: short-lived access token (15 min) + refresh; refresh rejected if user deactivated or role changed with `force_reauth` flag; admin can revoke all sessions.

### 5.5 Flow E — Managing users day to day

| Action | Who | Rules |
|---|---|---|
| Change roles | Customer Admin | Only allowed roles; cannot remove own Customer Admin role if last one; `AuditEvent role.changed` with before/after |
| Deactivate | Customer Admin / Noatum | `status=deactivated`, all sessions revoked, invitations revoked, data kept (audit trail, created-by references); user disappears from pickers |
| Reactivate | Customer Admin / Noatum | Back to active; requires re-authentication on next login |
| Delete (GDPR erasure) — **Phase 2** | Noatum only | Anonymise PII in `user` and in that user's audit payloads (email → hash, name → "Removed user"), keep id for referential integrity; `AuditEvent user.erased`; retention period pending Legal |
| Reset MFA | Customer Admin (local mode) | Removes devices; user re-enrols at next login |
| Sign out everywhere | Customer Admin / self | Revokes `user_session` rows |
| Edit own profile | User | Name, phone, locale, notification preferences; email change requires re-verification |

### 5.6 Flow F — Noatum manages the customer over time

| Action | Rules |
|---|---|
| Add / move / suspend org code | Always via `mapping_change_request` + approval + re-evaluation (KB-CW1 note §5.2) |
| Change feature flags | Immediate; `AuditEvent flags.changed`; UI re-reads flags on next navigation |
| Change tier | May change default alert set and premium flags (OQ-10) |
| Suspend group | All users blocked at login with a clear message; data retained; integrations continue to ingest |
| Close group | Users deactivated, accounts suspended (mapping removed via request), retention timer starts |
| Impersonate a user | `platform.impersonate`; mandatory reason; banner shown; session runs in target's tenant context with target's permissions **minus** write actions unless explicitly enabled (read-only default is our proposal, ADR-003); every action audited with both ids; auto-ends after 60 min |

### 5.7 Flow G — Access request from the public site (gap, not in PRD)

If approved as an addition: public form (company, name, email, Noatum contact) → creates a ticket for Customer Success (email or D365 lead). Creates **nothing** in the platform. Rate-limited and bot-protected. Flag in `docs/gaps.md`.

## 6. API surface (v1)

**Noatum admin** (internal permissions)

```
POST   /admin/customer-groups                         platform.groups.manage
GET    /admin/customer-groups?q=                      platform.groups.manage
GET    /admin/customer-groups/:id                     platform.groups.manage
PATCH  /admin/customer-groups/:id                     platform.groups.manage   (name, tier, flags, domains, identity_mode, parent)
GET    /admin/cw1-organisations?q=                    platform.accounts.request (search master_org_code)
POST   /admin/customer-groups/:id/account-requests    platform.accounts.request
POST   /admin/account-requests/:id/approve            platform.accounts.approve (requester ≠ approver)
POST   /admin/account-requests/:id/reject             platform.accounts.approve
POST   /admin/customer-groups/:id/invitations         platform.invite_admin     (role = Customer Admin)
POST   /admin/impersonations                          platform.impersonate      (target_user_id, reason)
DELETE /admin/impersonations/current                  platform.impersonate
GET    /admin/customer-groups/:id/audit               platform.groups.manage
```

**Customer admin** (tenant-scoped automatically)

```
GET    /users                                         admin.users
POST   /invitations                                   admin.users
POST   /invitations/:id/resend                        admin.users
DELETE /invitations/:id                               admin.users
PATCH  /users/:id/roles                               admin.roles.assign
PATCH  /users/:id/report-access                       admin.reports.assign  (active from Phase 2)
POST   /users/:id/deactivate | /reactivate            admin.users
POST   /users/:id/mfa/reset                           admin.users
POST   /users/:id/sessions/revoke                     admin.users
GET    /roles                                         admin.roles.assign        (allowed roles only)
GET    /audit                                         admin.audit.view          (own group)
```

**Self-service** (any authenticated user)

```
GET    /me
PATCH  /me                                            profile.manage_own
PATCH  /me/notification-preferences                   notifications.manage_own
POST   /me/sessions/revoke-all
GET    /invitations/:token          (public, token-authenticated)
POST   /invitations/:token/accept   (public, token-authenticated)
```

All list endpoints paginated; all write endpoints emit `AuditEvent`; all user-facing actions emit `AnalyticsEvent`.

## 7. Screens

**Noatum Admin workspace**
- Customers list (search, status, tier, accounts count, users count, last activity)
- Customer detail: Overview · Accounts (org codes with request/approve state, unmapped queue link) · Users · Feature flags · Hierarchy tree · Audit
- Account request approvals inbox (for approvers)
- Role designer (Platform Admin): permission matrix per role, custom roles per group
- Impersonation launcher + persistent red banner "Viewing as <name> — <reason> — End"

**Customer portal → Administration** (visible only with `admin.*`)
- Users: table (name, email, roles, status, last login), invite, resend, revoke, deactivate, roles drawer, report access (Phase 2)
- Roles: read-only list of allowed roles with their permissions in plain words
- Notification recipients (FG-4.3, Phase 3)
- Audit: own group's events, filter by user/action/date

**Self-service**
- Profile: name, phone, locale, MFA devices (local mode), active sessions
- Notification preferences

**Public**
- Login (email → home-realm discovery → IdP)
- Invitation landing page
- Error pages: expired invitation, account disabled, group suspended — all in brand voice, no exclamation marks

All screens use design-system components; status badges use the status-colour extension tokens.

## 8. Emails (rendered by the worker from branded templates)

| Email | Trigger | Content |
|---|---|---|
| Invitation | Flow A step 7, Flow C | Group name, inviter name, what the portal is, button "Accept invitation", expiry date `DD.MM.YYYY` |
| Invitation reminder | 2 days before expiry, once | Same link |
| Welcome | First successful login | What they can do given their roles, link to guides |
| Role changed | Roles updated by admin | New roles in plain words |
| Account deactivated | Deactivation | Neutral wording, Noatum contact |
| MFA reset | Reset by admin | Instructions for re-enrolment |
| Security notice | New device / IdP link | "If this was not you, contact your administrator" |

No emoji, no exclamation marks, sentence-case headlines, red header band and footer.

## 9. Security rules specific to this area

- Invitation tokens: 32 random bytes, stored hashed, single-use, 7-day expiry, bound to the invitation email.
- The login page must not reveal whether an email or domain belongs to a customer: everyone is sent to Entra; local-account customers use a per-customer URL.
- Local passwords: length ≥ 12, breached-password check, argon2id hashing; MFA mandatory for local accounts (PRD FG-10).
- Lockout after 10 failed attempts for 15 minutes; admin unlock available.
- Identity matching after first link is by (provider, subject) only — an attacker who controls a same-email account at another IdP gets nothing.
- Impersonation is read-only by default, time-boxed, banner always visible, dual-id audit.
- Tenant-isolation tests for every endpoint in §6 (group A admin cannot list, invite into, or change users of group B).
- Rate limits on `/invitations/:token*`, `/login`, and any public form.
- PII in logs is masked; audit `before/after` excludes secrets.

## 10. Analytics events (for FG-8.6 later)

`group.created`, `account.mapped`, `invitation.sent`, `invitation.accepted`, `invitation.expired`, `login.success`, `login.failed`, `role.changed`, `user.deactivated`, `impersonation.started`. Emitted from day one so Phase 4 dashboards (active vs inactive users, onboarding drop-off) have history.

## 11. Tests

1. Group A Customer Admin cannot see or invite into group B (404/403).
2. Invitation to an email outside `email_domains` is rejected for Customer Admin, allowed for Noatum with override.
3. Token used twice → second attempt refused; expired token refused; revoked token refused.
4. Identity email ≠ invitation email → acceptance refused.
5. Last Customer Admin cannot be demoted or deactivated.
6. Deactivation revokes sessions; next API call with old token → 401.
7. Role change takes effect on the next request without re-login.
8. Requester cannot approve own account request; approval creates accounts and triggers re-evaluation.
9. Impersonation without reason → 400; write action during read-only impersonation → 403; both ids in audit.
10. Parent-group admin sees child users; child admin does not see parent users.
11. Every route in §6 has `@RequirePermission()` (lint test).
12. Login discovery gives identical response for known, unknown and local-mode emails.
13. Requester cannot approve own mapping request (if 4-eyes is confirmed); otherwise confirm dialog is audited.

## 12. Mapping to slices

| Slice | Delivers from this document |
|---|---|
| **S1.02** Tenancy + identity | `customer_group`, `customer_account`, `user`, `user_identity`, `user_session`, OIDC login, home-realm discovery, tenant context, `GET /me`, hierarchy descendants |
| **S1.03** Roles | `role`, `permission`, `role_permission`, `user_role`, guard, six presets + internal roles, lint test |
| **S1.07** Integration backbone | `master_org_code` import that feeds the CargoWise organisation search |
| **S1.12** Customer admin + Noatum admin | `user_invitation`, `mfa_device`, `impersonation_session`, `mapping_change_request` flow, all screens in §7, all emails in §8, tests 1–12 |
| **S1.14** Hardening | pen test of this area, WCAG on login and admin screens |
| **S3.08** | Notification recipients management (Customer Admin) |
| **S4.08 / S4.09** | Training walkthrough on first login; platform analytics on the events in §10 |

## 13. Open points

| Item | Owner | Note |
|---|---|---|
| OQ-10 customer tiers | Commercial | Drives default flags and alert set |
| Identity mode per group: is customer SSO (SAML/OIDC federation) in Phase 1 or later? | IT | PRD FG-10 requires support; propose Entra External ID + local MFA in P1, federation P2 |
| Public "Request access" form | Product | Gap — not in PRD |
| GDPR retention period for deactivated users before erasure | Legal | PRD §7 "retention policies per artifact class" — value not given |
| Whether Customer Admins may create custom roles or only Noatum | Product | PRD FG-8.4 places the role designer internally; proposal: Noatum only |
| 4-eyes approval for org-code mapping and read-only impersonation | Mohamed | Both are our additions (ADR-003); default to built, easy to relax |
| Bulk invitation by CSV | Product | Deferred; not in PRD |
