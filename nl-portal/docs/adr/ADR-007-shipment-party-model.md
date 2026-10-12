# ADR-007 — Shipment parties: our own model, CargoWise mapped at the edge

| | |
|---|---|
| **Status** | Proposed · 15.09.2026 · awaits approval before any code |
| **Context** | Track and trace (FG-2) needs to show who the shipper, consignee and notify party are, and tenancy depends on matching a party to a linked organisation (ADR-003 decision 1). No `shipment` model exists yet, so the shape is still open. OQ-3a — "are parties stored as organisation codes or address codes?" — has been open since 09.09.2026 and the PRD calls it the most urgent technical question. |

## What the CargoWise schema actually says

Read directly from the published schema on 15.09.2026, not from summaries:

- `UniversalCommon.xsd` → `OrganizationAddress` (the party on a transaction)
- `Native.xsd` → `NativeOrganizationAddress` (the simplified transaction party)

| Field | Size | Required | Why it matters |
|---|---|---|---|
| `AddressType` | 40 | **Yes** | The only mandatory field. This is what distinguishes shipper from consignee |
| `OrganizationCode` | 12 | No | Our tenancy key — but optional |
| `AddressShortCode` | 25 | No | Display only, never an access grant |
| `AddressOverride` | boolean | No | The address was typed over and no longer matches master data |
| `ScreeningStatus` | CodeDescriptionPair | No | Sanctions / denied-party screening |
| `GovRegNum` + `GovRegNumType` | 254 + 3 | No | Tax or EORI captured on the party itself |
| `LocalAddressCollection` | repeating | No | The same address in a local language |

Four consequences follow, and they are the reason for this ADR:

1. **`AddressType` is not an enumeration.** It is a free 40-character string, while
   `Action` and `RelatedPartyType` in the same schemas *are* enumerated. The real value
   list therefore only exists inside Noatum's CargoWise. This is the document-type problem
   again: manually maintained, unvalidated, and unsafe to hard-code.
2. **A party can arrive with no identifying code at all.** Both `OrganizationCode` and
   `AddressShortCode` are optional; only `AddressType` and free text are guaranteed.
3. **A party's address is not master data.** `AddressOverride` says so explicitly.
4. **CargoWise does have an enumerated party-role list elsewhere** — `RecipientRole`
   carries roughly eighty three-character codes (`CNE` consignee, `CNR` consignor,
   `FOR` forwarder, `PUP` pickup, `WHS` warehouse, `BCO` beneficial cargo owner …).
   It governs document recipients, not shipment parties, but it is a useful seed list
   and evidence that a short role vocabulary exists in their world.

## Decisions

1. **The portal owns the party vocabulary.** We define a short canonical role set sized to
   what the PRD actually needs, and store it in our own column. We do **not** mirror
   40-character CargoWise strings into the domain model. *Implements foundation rule 2.*
2. **`mapping_entry` is the only translation point**, under a new `domain`
   (`cw1_address_type`). The existing table already has the right shape
   (`domain`, `cw1_code`, `portal_code`) so no schema change is required.
   *Implements foundation rule 5.*
3. **An unmapped `AddressType` fails closed.** The raw value is stored, no role is
   assigned, the party grants no visibility, and the row is surfaced to operations.
   Never guessed, never defaulted to "other".
4. **Tenancy resolves from `OrganizationCode` alone** (FR-ORG-005, ADR-003 decision 1).
   `AddressShortCode` and `CompanyName` are display. A party with no organisation code is
   stored, visible to nobody, and queued — it is never matched by name.
5. **Transaction party addresses never write back to the organisation mirror.**
   `AddressOverride` means they can be one-off edits; `master_org` and `org_address` are
   fed only by the organisation import.
6. **`ScreeningStatus` and any internal flags are internal-only** on every surface —
   list, detail, export, alert, chatbot, API.

## Consequences

The party role shown to a customer is ours, translated once at the integration edge, so a
new CargoWise `AddressType` cannot change portal behaviour without an explicit mapping
row. The cost is that the mapping must be seeded before track and trace can display
parties, and an unseeded value produces a visible gap rather than a silent default —
which is the intended trade.

**This ADR does not settle OQ-3a.** The schema proves both codes *can* be sent; only
Noatum's own data shows which they populate. One real shipment XML containing a party
block answers it and simultaneously supplies the `AddressType` values to seed the mapping.
Until then, no party code is written.
