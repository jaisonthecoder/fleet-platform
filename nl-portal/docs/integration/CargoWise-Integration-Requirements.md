# What we need from CargoWise

| | |
| --- | --- |
| Version / date | 1.0 / 15.09.2026 |
| From | Noatum Customer Information Platform team |
| For | CargoWise and integration team |

This is what the Noatum Customer Platform needs from CargoWise to exchange data. We keep a
synchronised copy of CargoWise data for speed; CargoWise stays the system of record.

## 1. Data we need to receive from CargoWise

| Data | What we do with it |
| --- | --- |
| Organisations — customers, suppliers, carriers, with code, name, country, controlling branch, addresses and tax identifiers | Link each portal customer to its CargoWise organisations |
| Quotes created or priced in CargoWise | Show them to the customer in the portal |
| Shipments, consols, containers and transport legs | Track and trace |
| Milestone events | Shipment timeline and alerts |
| Documents | Customer document access, approved types only |
| Invoices and credit notes | Finance visibility, by addressee |
| Booking confirmations and shipment references | Link bookings to shipments |

## 2. Data we need to send to CargoWise

| Data | When |
| --- | --- |
| Quote request | A customer submits a request in the portal |
| Priced quote | An internal user prices it in the portal |
| Quote accept, reject or cancel | The customer decides |
| Booking create, update or cancel, with documents | Booking from a quote or directly |

## 3. Reference and code lists

Charge codes, event codes, document types, UN/LOCODE, currencies, vessels and branch codes,
so we map CargoWise codes to portal values and keep them current.

## 4. For each message above

- One real sample payload.
- The field list — names, types and which fields are mandatory.
- What triggers it and in which direction.
- The field that uniquely identifies it, so a repeated delivery is not duplicated.

## 5. Connection

- The endpoint URLs we send to, and how CargoWise delivers to the endpoints we provide, for
  test and production.
- Authentication details — token URL, credentials, scope, token lifetime, and any
  certificate or IP allowlist.
- A test instance, or a set of sample messages, to build against.
- How CargoWise confirms receipt and business acceptance, and how failures are reported.

## 6. What we need first

1. The organisation list and how we receive it — a push on change or a scheduled extract —
   because customer onboarding depends on linking customers to their CargoWise organisations.
2. The quote messages — request, priced quote, confirmation, accept and reject.

Everything else can follow. Until these arrive we continue on our CargoWise simulator and
switch to the real connection by configuration.
