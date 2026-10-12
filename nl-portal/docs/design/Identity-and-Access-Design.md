# Identity and Access — External Customers and Internal Staff

| | |
|---|---|
| **Question answered** | How do external users get accounts, how are they stored, how do they authenticate, and how is authorisation decided — compared with internal staff on Azure SSO |
| **Aligned to** | PRD FG-8.2, FG-8.4, FG-10, §7 · LLD v3 §3, §4, §8, §9 · ADR-004 |
| **Written** | 04.09.2026 |

---

## 1. The one-line answer

**Pilot scope update, 15.09.2026:** the Entra-only explanation below is the earlier design. [ADR-006](../adr/ADR-006-pilot-portal-managed-authentication.md) selects portal-managed customer authentication and a local bootstrap administrator for the pilot, while preserving staff SSO. Use the [pilot implementation plan](../plans/implementation-plans/Pilot-Portal-Authentication-Implementation-Plan.md) and [updated onboarding flow](../process/External-User-Onboarding-Flow.md). Existing authorization/tenancy protections remain; this historical body is not authority to reintroduce Entra groups or bypass local-account controls.

**Both** internal staff and external customers sign in with Microsoft. Staff use **Entra ID** (the Noatum corporate tenant, the same account as their email). Customers use **Entra External ID** (a separate tenant built for people who are not Noatum employees). Our platform writes **no login, password, MFA or session code** — we validate the token Microsoft issues and decide what the person may do.

```
Noatum staff ──► Entra ID (corporate tenant)      ─┐
                                                   ├─► access token ─► our API validates it ─► loads the user ─► permissions
Customer users ─► Entra External ID (customer tenant) ─┘
```

---

## 2. Why external users need a separate tenant

The corporate Entra ID tenant holds Noatum employees. Putting customers in it would mean creating directory objects for thousands of outsiders inside the company directory, with the licensing, group-policy and security consequences that follow.

**Entra External ID** is Microsoft's product for exactly this: a separate directory for external identities, in the same Azure estate, administered by Noatum IT, with three sign-in options behind one door:

| Customer situation | How they sign in | Who manages the credential |
|---|---|---|
| The company uses Microsoft 365 | Their own work account | Their IT |
| The company has its own identity provider (Okta, ADFS, another Entra tenant, any SAML/OIDC) | Federation configured in Entra External ID — the customer is redirected to their own sign-in page | Their IT |
| The company has neither | Entra creates an email-and-password account with multi-factor authentication | Microsoft |

The third case matters: it is what earlier versions of our design were going to build ourselves (`local_credential`, `mfa_device`, recovery codes, lockout). Entra does it, so we deleted all of it (ADR-004). Federation is configuration in Entra, not code in our platform.

---

## 3. Getting an account: invitation only

There is **no self-registration** anywhere in the platform. The PRD has no sign-up page.

```
Noatum Customer Success                    Customer Admin
        │                                        │
        ▼                                        ▼
 invites the first admin  ───hand over───►  invites colleagues
 (one named person, company email)          (same mechanism, same domain check)
```

- **Noatum invites the first Customer Admin** of a new customer, by name and email.
- **That admin invites everyone else** at their company and assigns roles. Noatum is not involved after that.
- Invitations are **single-use**, **expire** (7 days by default), and are **bound to the email address** — the identity used to sign in must present the same email or acceptance is refused.
- The email must be on a **domain we recorded for that customer** (`gulffresh.ae`). Only Noatum can override, for agents or consultants.
- The token is stored **only as a SHA-256 hash**; the raw token exists only in the email link.
- An Entra account with no invitation and no portal user gets **403 identity unknown**. Having a Microsoft account gives no access by itself. The Entra External ID tenant is configured **invitation-only**, so self sign-up is off.

---

## 4. What we store, and what we deliberately do not

### We store (in PostgreSQL)

| Table | Holds |
|---|---|
| `customer_group` | The customer company: name, country, tier, feature flags, allowed email domains, hierarchy parent |
| `customer_account` | One CargoWise organisation code linked to that customer — what grants access to cargo |
| `user` | Who the person is in our world: email, display name, locale, status, their customer, optionally one office, and **`idp_issuer` + `idp_subject`** — the pointer to their Microsoft identity |
| `user_invitation` | Pending invitations: email, roles, hashed token, expiry, who invited them |
| `role`, `permission`, `role_permission`, `user_role` | What each person may do |
| `impersonation_session` | Support sessions where a Noatum admin views a customer's screen, always read-only, always with a reason |
| `audit_event` | Every administrative action, with the email stored as a hash plus domain |

### We never store

- Passwords, password hashes, MFA secrets, recovery codes — Microsoft holds these.
- Session tokens or refresh tokens of our own — we have no session table.
- Raw invitation tokens.
- Plain-text email addresses in audit payloads.

**`idp_subject` is the anchor.** After the first sign-in, a person is recognised by `(issuer, subject)` from their Microsoft identity, never by email alone. If someone changes their email, the link survives; if an attacker controls a same-email account elsewhere, it gains nothing.

---

## 5. Authentication — how a sign-in actually works

```
1. User opens the portal
2. The browser app (MSAL, PKCE) redirects to Microsoft
     staff → Entra ID · customers → Entra External ID
3. Microsoft handles everything: password, MFA, federation to the customer's own IdP,
   password reset, lockout, "remember this device"
4. Microsoft returns an access token for our API
5. Every API call carries that token
6. Our API validates it: signature, issuer (one of two accepted), audience, expiry
7. Our API looks the person up by (issuer, subject)
       not found → 403 identity unknown
       status not active → 401 account disabled
8. Request proceeds
```

**What this removes from our codebase:** login endpoints, password rules, hashing, MFA enrolment and verification, lockout counters, refresh-token rotation, "sign out everywhere", password-reset email flows, home-realm discovery, and the email-enumeration problem that came with it.

**Token lifetimes** are Microsoft's defaults, managed centrally by IT policy — typically an hour for the access token with silent renewal in the browser. Conditional access (require MFA, block countries, require compliant device) is also an Entra policy, applied without touching our code.

---

## 6. Authorisation — what the person may do

Authentication says *who you are*. Authorisation is entirely ours, and has three independent layers. All three are enforced **server-side, on every request**. The screens also hide what you cannot do, but hiding is never the control.

### Layer 1 — Which customer's data (tenancy)

Every request runs inside a tenant context: the user's customer, plus its child companies if there is a hierarchy. Two locks:

- the data-access layer adds the customer filter to every query;
- PostgreSQL **row-level security** re-checks the same condition, so even a bug in a query cannot return another customer's rows.

Shipments are the special case: one shipment can legitimately belong to two of our customers (shipper and consignee), so visibility comes from a link table populated when the message arrives from CargoWise, based on the CargoWise organisation codes we linked at onboarding.

### Layer 2 — Which actions (permissions)

A role is a **named list of permission codes**; a user may hold several roles and gets the union.

| Role | Permissions |
|---|---|
| **Standard** | see shipments, download documents, manage own profile and notifications |
| **Quoting and Booking** | Standard + create, submit and accept quotes; create, submit and cancel bookings; templates; address book |
| **Finance** | Standard + view invoices and credit notes, spend reports |
| **Analyst** | Standard + run and schedule reports, build own reports |
| **Claims** | Standard + raise claims and comment |
| **Customer Admin** | Standard + manage users, assign roles, assign report access, manage notification recipients, view own audit, address book including delete |

Internal roles: **Customer Success** (create customers, link CargoWise records, invite the first admin, publish news, impersonate), **Ops** (see across customers, read-only, never restricted financial content), **Platform Admin** (everything, plus feature flags and mapping tables).

Every API route declares one permission code; a guard checks it. Because permissions are separate codes, "may prepare a quote but not send it" already works — `quote.create` without `quote.submit`. No new code needed.

### Layer 3 — Which features (feature flags)

Each customer has a flag set: documents, financials, tracking, CO2, predictive, claims, booking. A feature that is off is refused by the API and hidden in the UI. This is how we release phase by phase, customer by customer.

**Plus one narrower rule:** a user can optionally be tied to a single office. If set, they see only invoices addressed to that office; if not, they see all of their company's.

---

## 7. Internal staff, side by side with customers

| | Internal staff | External customers |
|---|---|---|
| Directory | Entra ID, Noatum corporate tenant | Entra External ID, separate tenant |
| Account created by | Existing employee account | Invitation from Noatum or their own admin |
| Sign-in | Corporate SSO, same as email | Microsoft account, their company's IdP, or Entra-managed email and password with MFA |
| Belongs to a customer | No — marked internal | Yes, exactly one |
| Sees | All customers, except content flagged restricted | Only their own customer, and its children if a hierarchy exists |
| Can do | Administration only: customer set-up, mapping, news, flags, support | Everything the portal offers, by role |
| Operational work | Stays in CargoWise, not the portal | — |

**Impersonation.** A Noatum admin with the right permission can view a customer's screens to help them: a mandatory reason, a 60-minute limit, a visible banner, always read-only, and every action recorded with both identities.

---

## 8. Lifecycle events

| Event | What happens |
|---|---|
| Person leaves the customer | Their admin deactivates them; the next request is refused. Data and audit stay. Reactivation is possible |
| Person changes role | Effective on the next request, no re-login — permissions are read per request, not baked into the token |
| Person forgets password | Microsoft handles it; we are not involved |
| Person's MFA device is lost | Microsoft handles it, or their own IT does if federated |
| Customer is suspended | All their users are blocked at the API; data is retained; integration keeps ingesting |
| Last Customer Admin | Cannot be demoted or deactivated — the server refuses, so a customer is never locked out of its own administration |
| GDPR erasure | Phase 2: personal data is anonymised in the user record and in audit payloads, the row is kept for referential integrity. Retention period pending Legal |

---

## 9. Security properties this design gives us

- **No credential handling on our side** — the largest class of authentication vulnerabilities simply does not exist in our codebase.
- **Conditional access, MFA policy and device compliance** are set centrally by IT and apply immediately, with no release from us.
- **No user enumeration** — everyone is sent to Microsoft; our API never reveals whether an email is known.
- **Tenancy enforced twice**, in the application and in the database.
- **Every route permission-checked**, verified by a test that fails the build if a route is missing its declaration.
- **Full audit** of administrative actions, with both identities recorded during impersonation.
- **Cross-tenant tests in CI** — a user of customer A must get 404 for every entity of customer B.

---

## 10. What we need from IT

| Item | Why |
|---|---|
| An **Entra External ID tenant** for customers, configured **invitation-only** (self sign-up disabled) | Customer sign-in |
| **App registrations** for the browser app and the API, per environment | Token issuance and validation |
| Confirmation that **federation to a customer's own IdP** will be configured in Entra when a customer asks | Avoids us building a second sign-in path |
| **Conditional access and MFA policy** for the external tenant | Security posture, set centrally |
| An **email sending domain** with SPF and DKIM for invitations and notifications | Invitations must not land in spam |
| Which internal group or accounts map to the **Platform Admin** role initially | Bootstrapping |

---

## 11. Open points

| # | Item | Owner |
|---|---|---|
| 1 | Confirm no public "request access" form is wanted | Sponsor |
| 2 | May a Customer Admin invite outside their company email domain? Proposal: no, Noatum can override | Sponsor |
| 3 | Retention period before a deactivated user's data is anonymised | Legal |
| 4 | Whether a second Noatum person must approve linking a customer to its CargoWise records | Sponsor |
| 5 | Named people for the internal Customer Success and Platform Admin roles at pilot | Sponsor |
