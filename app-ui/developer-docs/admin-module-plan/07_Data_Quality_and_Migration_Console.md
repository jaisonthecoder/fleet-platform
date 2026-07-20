# Phase 07 — Data Quality & Migration Console (Data Steward)

> **Backend readiness: ✅ ready** (sub-phase 1B/M3). The import pipeline — stage → validate → dedup →
> reconcile → steward sign-off → commit — is built and stable. This is a **fully backable** production
> screen and a strong second/third slice after Reference Data.
>
> **Owner:** `DataSteward` (+ `SystemAdmin`). **Module:** `features/governance/data-quality/`.
> **Route:** `/{lang}/data-quality`. **Spec:** H1.

---

## 1. Business context (P7)

Vehicle inventory arrives from scattered spreadsheets of inconsistent quality. The Data Steward owns
**bringing it in cleanly**: upload a batch, see row-level validation rejects with reasons, resolve/reconcile
duplicates, watch the **completeness score**, and **sign off** — records only go operational at **≥ 98%
completeness** with an explicit steward sign-off. This directly serves outcome O1 (single governed vehicle
master) and depends on **Reference Data** (Phase 02) for code validation.

**Guardrails:**
- **Sign-off is gated** at `IMPORT_COMPLETENESS_THRESHOLD = 98` — the UI shows the score vs threshold and
  disables sign-off below it with a clear reason.
- Commit is **irreversible-ish** (creates vehicle-master rows) — always confirm.
- Batch size is capped (`rows.max(5000)`) — the UI validates client-side before upload (DoS guard parity).
- Dedup merge is **destructive** — side-by-side compare + confirm before merge.

---

## 2. Backend surface (exact)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/v1/imports` | DataSteward\|FleetManager\|ClusterFleetLead\|SystemAdmin | Create batch (stage + validate + reconcile) |
| GET | `/api/v1/imports/:id` | same | Batch summary (counts + completenessScore + status) |
| GET | `/api/v1/imports/:id/rows` | same | Per-row status/reason/committedVehicleId |
| POST | `/api/v1/imports/:id/resolve` | same | Accept/reject a flagged row |
| POST | `/api/v1/imports/:id/sign-off` | same | Commit valid rows (threshold-gated) |

**Contracts (mirror in `features/governance/data-quality/import.contract.ts`):**
`ImportBatch { id, status, totalRows, validRows, invalidRows, duplicateRows, completenessScore, signedOff }`
(status: `Staged|Validated|SignedOff|Committed|Rejected`), `ImportRow { id, rowNumber, status, reason,
rawData, committedVehicleId }` (status: `Pending|Valid|Invalid|Duplicate|NeedsResolution|Committed`),
`createImportSchema { rows: RowInput[] (1..5000) }`, `resolveRowSchema { rowId, action:'accept'|'reject' }`,
`IMPORT_COMPLETENESS_THRESHOLD = 98`.

---

## 3. Data hooks (`hooks/use-imports.ts`)

```ts
useImportBatch(batchId)     // ['governance','imports', batchId] — poll while status is Staged/Validating
useImportRows(batchId)      // ['governance','imports', batchId, 'rows']
useCreateImport()           // POST /imports (client parses CSV/XLSX → rows JSON); toast + navigate to batch
useResolveRow(batchId)      // POST resolve; invalidate batch+rows; toast
useSignOffBatch(batchId)    // confirm; POST sign-off; invalidate; success/at-threshold error handling
```
- **CSV/XLSX parse is client-side** (the API takes JSON rows) — use a small parser (e.g. `papaparse`
  for CSV; XLSX optional/enhancement). Validate row count ≤ 5000 before POST.

---

## 4. Screen design

### `/data-quality` — Console (`pages/data-quality-page.tsx`)
`AdminPageLayout` with:
- **Batch history** table (recent imports): Batch | Uploaded | Status chip | Rows | Completeness (progress
  bar vs 98% target) | ⋯ → open batch. **Primary action:** `+ Import batch` (upload modal).
- **Completeness dashboard**: a `StatCard` row (total / valid / invalid / duplicate) + a `Progress`/`BarChart`
  showing completeness vs the 98% target line (reuse the charts kit).

### Import batch (modal) — `+ Import batch`
- File drop (CSV/XLSX) → client parse → **preview** first N rows + detected columns (header mapping shown) →
  validate count ≤ 5000 → `POST /imports` → navigate to the batch validation view. Progress + errors surfaced.

### Validation report (batch view) — `pages/import-batch-page.tsx` (`/data-quality/:batchId`)
- Batch header: status, counts, **completeness score vs threshold** (progress + pass/fail chip).
- `ResourceTable<ImportRow>`: Row# | Status chip (Valid/Invalid/Duplicate/NeedsResolution) | Reason |
  Key fields (plate/VIN) | ⋯. **FilterBar:** status filter (focus on Invalid/NeedsResolution), search.
  - Row action **Resolve** → accept/reject (with reason display); invalid rows show *why* (lookup code
    invalid, missing required field, duplicate of existing plate/VIN) — "blocks explain themselves".
- **Dedup compare-and-merge** (modal) — side-by-side of the incoming row vs the existing record; confirm
  before merge (destructive).
- **Batch sign-off** (action) — enabled only at ≥ 98%; confirm → commit; on success show committed count +
  link into the Fleet registry; below threshold → disabled with the exact gap explained.

---

## 5. Reusable components used / created

| Component | Source | Notes |
|---|---|---|
| `AdminPageLayout`, `ResourceTable`, `FilterBar`, `DetailDrawer`, `StatCard`, charts | shared kit | reused |
| `FileDropzone` + `useCsvParse` | **new shared** (`components/patterns/file-dropzone.tsx`, `lib/parse-csv.ts`) | reused by any bulk-import (reference-data bulk, fines import) |
| `CompletenessMeter` | **new shared** | score vs target bar+chip (reused by any quality gate) |
| `CompareMergePanel` | **new shared** | side-by-side record diff + merge confirm (reused by dedup elsewhere) |
| `StatusChip`, `useConfirm`, `notify` | existing | row/batch status + confirms + toasts |

`FileDropzone`, `CompletenessMeter`, `CompareMergePanel` are generic quality/import primitives — shared kit.

---

## 6. RBAC & governance

- Route `RequireRole roles={['DataSteward','SystemAdmin']}` (FleetManager/ClusterFleetLead can also import
  per backend — add them if the fleet module reuses this console).
- Sign-off + merge always confirm; commit is audited server-side.
- Reference Data must be seeded first (codes validate against lookups) — cross-link to `/admin/reference-data`.

---

## 7. i18n keys (`governance.dataQuality.*`)

```
title, subtitle, history.col.batch|uploaded|status|rows|completeness|actions, action.import,
upload.title, upload.drop, upload.preview, upload.tooMany, batch.summary, batch.signOff,
row.col.number|status|reason|key|actions, action.resolve, resolve.accept, resolve.reject,
dedup.title, dedup.merge, confirm.signOff*, confirm.merge*, threshold.belowNote, empty.batches
```

---

## 8. Tests

- `use-imports.test.ts` — create/get/rows/resolve/sign-off parse; poll transitions; sign-off invalidation.
- `data-quality-page.test.tsx` — batch history + completeness dashboard; import modal parses CSV → POST.
- `import-batch-page.test.tsx` — rows table, filter to invalids, resolve row → POST + recount; sign-off
  disabled < 98% with reason; ≥ 98% → confirm → commit + committed count.
- `file-dropzone.test.tsx`, `completeness-meter.test.tsx`, `compare-merge-panel.test.tsx` (shared).

**MSW:** POST `/imports`, GET `/imports/:id`, GET `/imports/:id/rows`, POST `/imports/:id/resolve`,
POST `/imports/:id/sign-off` (below-threshold + at-threshold branches). Remove per screen once live-verified.

---

## 9. Backend / DB change register (proposed — mostly optional)

1. **Server-side file upload** (`multipart` CSV/XLSX) so very large files don't parse in the browser +
   the 5000-row cap can grow (BullMQ sandbox already envisaged). **Medium**, optional (client parse works now).
2. **Batch list endpoint** — `GET /imports?status=&page=` for the history table (today the UI tracks
   batches locally / by id). **Small.**
3. **XLSX support** server-side (currently JSON rows) if browser XLSX parsing is undesirable. **Small–medium.**

Ships fully today with client CSV parsing; (2) improves the history view.

---

## 10. Exit checklist

- [ ] `import.contract.ts` mirrors batch/row/resolve + threshold; parsed on fetch.
- [ ] Console: batch history + completeness dashboard + import modal (client CSV parse, ≤5000 guard).
- [ ] Batch view: row table with reasons, resolve flow, dedup compare-merge, threshold-gated sign-off.
- [ ] `FileDropzone`, `CompletenessMeter`, `CompareMergePanel` added to shared kit + tested.
- [ ] RBAC guard; cross-link to Reference Data; i18n EN/AR; RTL verified.
- [ ] MSW handlers + tests (below/at threshold); live-verified; handlers removed.
- [ ] Optional backend items filed in register (file 10).
- [ ] Gate green.
