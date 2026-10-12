# Customer identity explained

In simple English, this requirement means: **Before customers can use the portal, we must prepare Microsoft's login service and agree how approved customers receive access.**

## Two separate responsibilities

| Microsoft Entra External ID | Our portal database |
| --- | --- |
| Verifies who the person is | Decides which customer company they belong to |
| Handles configured sign-in, passwords and MFA | Stores their roles and permissions |
| Issues proof of successful authentication | Controls which records and menus they can access |

**A successful Microsoft login does not automatically grant portal access.**

## External ID setup

IT creates a dedicated **external tenant**, meaning a Microsoft identity directory for our customers, separate from Noatum's staff directory.

For example, Maria works for customer company ABC Logistics. Her customer identity is managed through External ID. A Noatum pricing employee signs in through Noatum's corporate Entra ID. Neither needs a password stored in our portal database.

Maria may use an External ID-managed account or her company identity through an approved federation setup. **An existing Microsoft account does not automatically mean company SSO is configured.**

## Invitation and provisioning

These words describe different things:

- **Invitation:** Noatum approves Maria to join ABC Logistics in the portal.
- **Provisioning:** Create or establish the Microsoft identity and the portal user record Maria needs.

### Example customer journey

1. Noatum creates ABC Logistics in the portal and links its approved CW1 organisations.
2. Noatum invites `maria@abc.example` as the first Customer Admin.
3. Maria receives a single-use, expiring invitation link.
4. Her Microsoft customer identity is created or connected through the approved External ID process.
5. Microsoft authenticates Maria. Our portal verifies that the invitation is valid and matches her verified identity/email.
6. Our portal links her identity to ABC Logistics and assigns the invited Customer Admin role.
7. Maria can invite colleagues and assign allowed customer roles. She cannot access another customer's records.

**Important clarification:** sending our portal invitation does not automatically create an External ID account. The identity team must agree whether accounts are pre-created through approved administration/provisioning or established through a controlled enrolment flow. Hiding a "Sign up" button alone is not invitation-only security. This is also different from inviting a guest into Noatum's staff tenant.

The **internal staff** flow remains different: eligible staff sign in with corporate Entra, receive a portal record without business roles, and wait for an administrator to assign access.

## Registrations and sign-in

**App registrations** means registering the software, not registering individual customers. Think of telling Microsoft: "This is our portal, this is its API, and these are the approved login destinations."

The configuration covers:

- **Application/client ID:** identifies the portal application.
- **API audience and scopes:** identify the API the token is intended for and the delegated access requested; they do not replace portal business permissions.
- **Redirect URLs:** approved locations Microsoft can return users to after sign-in.
- **Sign-in policy:** permitted identity methods, MFA, password recovery, branding and languages.
- **Environment separation:** development/test login must not accidentally return users to production. The browser app must not contain a client secret.

## Test identities

These are controlled accounts for testing, not real production customers. We need ABC and XYZ customer users to prove isolation, a Finance user to test invoice access, an invited-but-not-activated user, and staff with and without assigned roles.

Tests should also cover expired invitations, wrong-email acceptance and deactivated accounts.
