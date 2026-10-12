# External-user onboarding for the pilot

Updated 15.09.2026 by user decision: **the pilot uses our portal API and PostgreSQL for external-customer authentication, without Entra External ID or Keycloak.** Staff SSO remains separate. Portal roles and customer access continue to be managed by our application.

This replaces the previous External ID flow in this working guide. It is the approved approach, not a claim that login is implemented. See [ADR-006](../adr/ADR-006-pilot-portal-managed-authentication.md) and the [detailed phased plan](../plans/implementation-plans/Pilot-Portal-Authentication-Implementation-Plan.md).

## Customer activation

1. Noatum creates the customer and links its CargoWise organisations.
2. An authorized employee invites the first Customer Admin, for example `ahmed@customer.com`. Our backend stores the approved customer/roles, invitation expiry and a single-use token hash.
3. Our email integration sends an activation link. It protects any temporary delivery token material; plaintext tokens are not put in durable database job payloads or logs.
4. Ahmed opens **Activate your account** on our portal. Opening the link alone does not consume it, because email scanners also open links.
5. Ahmed sets a password and enrolls the required MFA using portal screens and maintained authentication libraries.
6. The API validates the invitation, checks account/customer eligibility again, and completes activation atomically. A changed, expired, revoked or already-used invitation cannot grant access.
7. Ahmed signs in through the portal and can invite colleagues only within his authorized customer and role-assignment permissions.

There is no public self-registration. The browser cannot choose a different customer, declare itself internal or submit arbitrary roles. Existing accounts are never merged by email alone.

## Normal sign-in

Customer enters email and password -> API verifies the Argon2id hash and account status -> required MFA is completed -> API issues an opaque server-side session through a protected cookie -> subsequent requests resolve that session to the existing portal user and current permissions.

Passwords are never stored in plaintext or emailed. The browser does not store authentication tokens in localStorage. Session expiry, CSRF protection, rate controls and revocation are enforced by the backend, not just by hiding UI controls.

## What we store

| Information | Storage/owner |
| --- | --- |
| Password verification | Argon2id hash with parameters in restricted PostgreSQL credential storage |
| Session | Random token in Secure/HttpOnly cookie; only its digest and server-side state in PostgreSQL |
| User identity | Immutable portal user ID; existing external issuer/subject bindings preserved for SSO |
| MFA | Library-managed state; encrypted factor secret if TOTP is selected; encryption key outside the database |
| Recovery and invitation tokens | Purpose-bound, expiring, single-use digests; protected short-lived email delivery material where required |
| Customer and roles | Existing portal database records and RLS |
| Security history | Redacted audit/analytics; no passwords, raw tokens or MFA secrets |

## First Portal Admin

An authorized operator provisions the named first internal administrator. A one-time setup process establishes credentials and MFA without corporate SSO. No default password, public admin signup, first-login-wins rule or development bypass is used. Re-running setup must not restore roles that were deliberately removed.

## Forgot password or lost MFA

The portal sends a short-lived reset link through the email provider and performs the approved identity/MFA recovery checks. Password reset alone does not remove MFA. Successful recovery invalidates the relevant tokens/sessions and records an audit event. Customer admins cannot read another person's password or factor secrets.

## Services still needed

- Portal UI/API hosting, HTTPS and PostgreSQL.
- Approved transactional email service, such as Azure Communication Services Email, for invitations, resets and notifications.
- Secure key/secret storage, such as Azure Key Vault, and monitoring/support.
- Maintained authentication, session, hashing and MFA libraries selected under the implementation plan.

Entra External ID and Keycloak are not pilot customer-sign-in dependencies. Corporate Entra may still authenticate employees. Adopting local authentication means our team owns password/session/MFA/recovery security and must obtain release assurance before the pilot handles real customer accounts.

**Current state:** documentation and phased plan updated; application implementation and verification pending. Tests, lint and other checks remain user-scheduled.
