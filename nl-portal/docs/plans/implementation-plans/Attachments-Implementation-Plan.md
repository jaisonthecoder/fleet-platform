# Attachments implementation plan

| Document control | Value |
| --- | --- |
| Version / date | 1.1 / 21.09.2026 |
| Status | Draft implementation plan for review and approval; not implementation evidence |
| Scope | Accepting, storing, listing and serving files on a quote - in both directions - and the reusable machinery every later module inherits |
| Relationship to other plans | Implements `docs/quotation/Q2-Document-As-Answer.md`. Extends it with the customer-to-staff direction Q2 does not cover. Bookings, claims, invoices and shipment documents reuse the machinery defined here without changing it |
| Governing sources | `docs/quotation/Q2-Document-As-Answer.md`; PRD FG-4; root `CLAUDE.md` rules 1, 2, 4 and 6; `docs/Simplification-Register.md` |
| Owners | Product, Security and Engineering; named owners to be assigned |

## 1. Purpose and outcome

Let a customer attach the papers that belong to a request, and let a branch answer with its
own document rather than a number.

> A quote may be answered with **an amount**, or with **at least one customer-visible
> document**, or **both** - never with neither. That single rule is the whole "no standard
> format" decision, expressed in code.

Two gaps close together:

- **Customer to staff.** A dangerous goods request has no way to carry its safety data
  sheet, and a packing list has nowhere to go. Today the pricer is asked to quote hazardous
  cargo on the strength of a form alone.
- **Staff to customer.** The publish guard already refuses a quote with neither an amount
  nor a document, and the code carries a comment admitting documents are not built - so in
  practice only an amount can ever satisfy it.

## 2. What already exists

Checked before planning, so nothing here is rebuilt.

| Piece | State |
| --- | --- |
| `documents.read`, `documents.download`, `documents.upload` | Permissions already defined and seeded |
| `TmsDocumentAdapter` | Port exists with `listDocuments`, `fetchDocument`, `pushDocument`, `getDocumentStatus`. Unbound |
| `UploadZone`, `AttachmentList` | **Deleted.** They existed in `KitAttachments` at v1.0 of this plan; the design-system rebuild removed the whole `Kit*` family. See §6.1 |
| `AttachmentItem.status` | Gone with the above. The status vocabulary is preserved in §6.2 |
| `documents` module | Empty shell, registered in `AppModule` |
| Azure Blob | **Provisioned 21.09.2026** - see §10.1 |

## 3. The reusability decision

The ask is explicitly for a reusable approach, so the choice is recorded rather than
assumed.

| Option | Verdict |
| --- | --- |
| **A.** `quote_document` only, exactly as Q2 states | Correct but not reusable. Bookings, claims and invoices each rebuild the pipeline |
| **B.** One polymorphic `document` table with `owner_type` + `owner_id` | **Rejected.** Loses foreign-key integrity, and RLS cannot express it: quote documents are Pattern A (`customer_group_id`), shipment documents are Pattern B (`shipment_visibility`). One policy cannot serve both |
| **C.** Per-entity link tables, shared machinery | **Chosen** |

Under option C the *table* is per-entity, because tenancy and referential integrity demand
it. Everything else is owner-agnostic and written once:

```
FileStorageAdapter       port: put / get / delete / signedUrl. Knows nothing about quotes
FileValidationService    magic-byte sniffing, size ceiling, safe name generation
DocumentTypeService      the rule 6 allow-list
AttachmentsService       upload / list / download orchestration, entity-agnostic
shared/attachments/*     React hook and panel over the design-system components
```

When bookings arrive, `booking_document` is about ten lines of DDL and **no** new code.
That is the reuse being asked for, without pretending two tenancy patterns are one.

## 4. Database

Two reversible migrations, each with `down.sql`. **No file bytes in PostgreSQL, ever.**

### 4.1 `stored_file` - reusable, owner-agnostic

| Column | Notes |
| --- | --- |
| `id` | uuid primary key |
| `blob_container`, `blob_name` | **We generate `blob_name`.** Never a client-supplied path or filename |
| `original_filename` | Display only. Never used as a path |
| `content_type`, `size_bytes` | Determined server-side, not taken from the client |
| `checksum_sha256` | Integrity, and lets an identical re-upload be recognised |
| `scan_status` | `pending \| clean \| infected \| skipped`. **Seam only in this phase** - see §7 |
| `uploaded_by_user_id`, `uploaded_at` | Who and when |

Internal-only RLS policy. A customer never reads this table directly; they reach a file
through the link table below, which carries the tenancy.

### 4.2 `quote_document` - Pattern A, per Q2

| Column | Notes |
| --- | --- |
| `quote_id` | FK to `quote`, cascade on delete |
| `customer_group_id` | **NOT NULL, indexed, RLS enabled and forced** |
| `stored_file_id` | FK to `stored_file` |
| `document_type` | Allow-listed code, never free text |
| `direction` | `from_customer \| to_customer` |
| `customer_visible` | boolean. Default `true` for `to_customer`, `true` for the customer's own upload |
| `position` | Display order |

`direction` is what lets one table serve both the safety data sheet a customer attaches and
the PDF a branch answers with. Without it we would need two tables that differ only in who
pressed the button.

## 5. Backend

### 5.1 The storage port

`src/contracts/adapters/file-storage.adapter.ts`, modelled on `EmailAdapter`, which already
solves exactly this problem for an Azure resource that did not exist yet:

```
abstract isConfigured(): boolean
abstract put(input: StoredFileInput): Promise<StoredFileHandle>
abstract get(handle): Promise<Buffer>
abstract delete(handle): Promise<void>
abstract signedDownloadUrl(handle, ttlSeconds): Promise<string>
```

Two implementations:

- `AzureBlobStorageAdapter` - the real one.
- `LocalDiskStorageAdapter` - development and test only. **Configuration must refuse to
  boot with this selected in production**, the same discipline `DEV_AUTH_ENABLED` already
  carries. This is a dev transport, not the database fallback Q2 forbids.

### 5.2 Module

`src/modules/documents/` - `documents.module.ts`, `documents.controller.ts`,
`attachments.service.ts`, `file-validation.service.ts`, `dto/`.

Routes:

| Route | Permission | Notes |
| --- | --- | --- |
| `POST /v1/quotes/:id/documents` | `documents.upload` | Multipart. Customer or staff, decided by `direction` |
| `GET /v1/quotes/:id/documents` | `quotes.read` | Customer surface omits internal rows at the query |
| `GET /v1/documents/:id/download` | `documents.download` | Returns a short-lived signed URL |

### 5.3 Validation, server-side only

- Magic-byte sniffing. A client-declared `Content-Type` is a claim, not a fact
- Size ceiling from a scoped setting, so a branch can differ
- Document type must be on the allow-list - rule 6 is an allow-list for documents, never an
  exclude-list
- Generated blob name `{customerGroupId}/{quoteId}/{uuid}{ext}`

### 5.4 The publish rule finally becomes satisfiable

`pricing.service.publish` already refuses when there is neither an amount nor a document,
and carries a comment saying documents are not built. Once `quote_document` exists,
`hasAnswer` counts customer-visible rows and that comment comes out. All four combinations
get a test.

## 6. Frontend

### 6.1 What the design-system rebuild changed

Inspected 21.09.2026, after the rebuild began. The findings below replace v1.0 §6.

| Finding | Evidence |
| --- | --- |
| shadcn is the primitive layer | `components.json`, style `new-york`, `ui` aliased to `design-system/primitives`. **29 primitives installed** including `button`, `progress`, `alert`, `card`, `dialog`, `label` |
| Tailwind v4, CSS-first | `@tailwindcss/vite`, `@import 'tailwindcss'` and `@theme inline` in `foundation.css`. No `tailwind.config` |
| Appearance stays in CSS | A primitive is shadcn plus `cn()` plus a `.noa-*` class - `primitives/input` is four lines wearing `.noa-control`. Bespoke components keep `.module.css` |
| **The attachment components were deleted** | `git status` shows `D src/design-system/components/KitAttachments.tsx` and `.module.css`, with the rest of the `Kit*` family. The deletions are **uncommitted** - the rebuild is in flight |
| **Nothing will rebuild them** | `documentation/ui-kit/PLAN.md` lists the remaining work as shared internals, selection, charts, loaders and "the rest". **FB-02 appears in none of them** |
| The contract survives | `07-feedback-and-overlays.md` still specifies FB-02: `EmptyState`, `AttachmentList`, `UploadZone`, under `components/feedback/` |

### 6.2 Where the upload lives, and why not in the design system

The design system is mid-rebuild and owned by another workstream; adding a component to
`components/feedback/` now would collide with uncommitted work. The user has also said a
new file upload will replace whatever we use, once confirmed.

So the upload is built **in the feature layer** behind a deliberately narrow seam:

```
src/shared/attachments/
  FileUpload.tsx        the ONLY file that knows how a picker is drawn
  AttachmentsPanel.tsx  composition: list + picker + errors. Talks to FileUpload only
  useAttachments.ts     query, upload mutation, progress
```

Replacing the picker later is a change to `FileUpload.tsx` and nothing else, because the
props below are ours, not a third party's.

**"shadcn-based" here means built the way every other primitive in this repo is built** -
`forwardRef`, `cn()`, the installed `button` and `progress` primitives, new-york
conventions, appearance in CSS - and **not** a new dependency. shadcn ships no file upload
in core; pulling a community dropzone would add a package whose styling does not know the
Noatum tokens, for a component the user intends to replace.

This also satisfies the kit's own FB-02 rules, which still apply: a **native file input**
with drag-and-drop as an enhancement rather than the only path, and progress and status
exposed **as text**, never as a file-type icon alone.

### 6.3 The seam

```ts
interface FileUploadProps {
  accept: string[];            // MIME types; the server still decides
  maxSizeBytes: number;
  disabled?: boolean;
  busy?: boolean;
  onFiles: (files: File[]) => void;
  onReject: (reason: 'type' | 'size' | 'count', file: File) => void;
}
```

Status vocabulary carried forward from the deleted component, because the upload lifecycle
needs all five: `idle | uploading | ready | failed | scanning`.

### 6.4 Placements

1. **Quote request page** - the customer's own papers, behind `documents.customer_upload`
2. **Pricing detail page** - the branch's document answer, with a customer-visible toggle

EN and ES strings, loading, empty and error states, `DD.MM.YYYY`, WCAG 2.1 AA.

## 7. Security

This is the first feature in the portal that accepts customer-supplied bytes, so the
decisions are stated rather than assumed.

- **Absent, not hidden.** `customer_visible = false` is omitted at the query, never filtered
  in React. A field that ships in JSON and is hidden by CSS is not hidden
- **No existence leak.** An unknown document and an out-of-scope document return the same
  404. A different status would confirm that somebody else's document exists
- **Download** is a short-lived signed URL. We never proxy a stream addressed by a
  client-supplied path
- **Audit** on upload and on download. A commercial document leaving the building is worth
  attributing
- **Malware scanning is deferred by instruction (21.09.2026).** `scan_status` ships as a
  column defaulting to `skipped`, so the seam exists and no migration is needed later. This
  is a recorded, accepted risk: customer-uploaded files will be downloadable by staff
  without being scanned. It should be closed before the portal is opened to customers
  outside the pilot

## 8. Switches and permissions

Permissions already exist. New switches, per foundation rule 4:

| Key | Default | Gates |
| --- | --- | --- |
| `documents.customer_upload` | **off** | A customer attaching files to a request. Off by default because it changes what a customer can do |
| `documents.quote_answer` | **on** | A branch answering with a document. On, because Q2 treats it as the normal path for some branches |

Scanning is deliberately **not** offered as a switch. When it is built it belongs in
`PROTECTED_CAPABILITIES` alongside tenancy and audit - safety is not configurable.

## 9. Tests

- All four combinations of the publish rule: amount only, document only, both, neither
- A foreign group's document cannot be downloaded, and 404s identically to one that does not exist
- A `customer_visible = false` document is absent from the customer list **and** detail
- Oversized and wrong-content-type uploads refused
- Declared content type contradicting the magic bytes is refused
- One tenant-isolation test on `quote_document`
- Storage port conformance, both implementations

## 10. Phasing

| Phase | Deliverable | Needs Azure |
| --- | --- | --- |
| **D1** | `FileStorageAdapter`, local-disk implementation, validation service | No |
| **D2** | `stored_file` and `quote_document` migrations; upload, list, download | No |
| **D3** | Publish rule counts documents; the "not built yet" comment comes out | No |
| **D4** | Shared FE hook and panel; wired to pricing detail (staff answer) | No |
| **D5** | Wired to the quote request page (customer attachments), behind the switch | No |
| **D6** | `AzureBlobStorageAdapter`, Bicep module, production boot guard | Yes |

D1 to D5 are fully testable on local disk. Only D6 needs the container.

### 10.1 The provisioned container

| Item | Value |
| --- | --- |
| Subscription | `subs-adports-prod` (`0a249c66-024e-4317-987f-edb5c27bd6dc`) |
| Resource group | `az-adpapp-devxp-common-np-rg` |
| Storage account | `azadappnpuaendevxp` - **shared non-production developer-experience account**, `uaenorth`, StorageV2, Standard_LRS |
| Container | `noatum-quote-documents`, public access **off** |
| Verified | Create, upload, list and delete round trip 21.09.2026 using Entra auth (`--auth-mode login`) |

**Why this account and not a new one.** The signed-in operator holds `Reader` at
subscription level and `Storage Blob Data Contributor` on this account only. Creating a
dedicated storage account needs `Microsoft.Storage/storageAccounts/write`, which the
account does not have - the attempt failed with `AuthorizationFailed`. The container was
created through the data plane instead, which the existing grant does permit.

**Consequences to accept or fix before production:**

- The account is **shared with other non-production workloads**, so blob names are
  namespaced under the container rather than relying on account isolation
- Its network default is `Allow`. Acceptable for development, not for customer documents
  in production
- A dedicated account per environment, created from Bicep in
  `infra/bicep/modules/`, is still required for D6. That needs an operator with
  contributor rights on `az-adapp-noatum-customer-portal-np-rg`

Authentication uses **Entra (`DefaultAzureCredential`), not a shared key**, so no secret
needs to be held. The App Service managed identity will need `Storage Blob Data
Contributor` on the container when D6 lands.

## 11. Open items

| # | Item | Status |
| --- | --- | --- |
| A-1 | Azure Blob container | **Done 21.09.2026.** `noatum-quote-documents` on the shared dev account - see §10.1 |
| A-2 | Malware scanning | **Deferred by instruction.** Risk recorded in §7 |
| A-3 | Retention - how long an attachment outlives its quote | Open. No deletion is built in this phase |
| A-4 | Maximum file size and accepted types per branch | Proposed as a scoped setting; values to confirm |
| A-5 | Dedicated storage account per environment | Open. Blocked on contributor rights; needed for D6, not before |
| A-6 | The replacement file upload | Expected. `FileUpload.tsx` is the single swap point - see §6.2 |
| A-7 | FB-02 in the design system | Deleted in the rebuild and **on no roadmap**. If the design-system workstream later rebuilds it, `FileUpload.tsx` becomes a thin adapter over it rather than a reimplementation |
