# Forms Patterns

Forms are the dominant UI in AD Ports apps (vessel intake, bookings, customs declarations, manifests). The basics are in `references/react-architecture.md` §Forms. This file covers the patterns devs hit most often beyond the basics.

## Schema-first foundation

- One zod schema per form. Derive the form value type via `z.infer<typeof schema>`.
- Connect to react-hook-form via `zodResolver(schema)`.
- Default values: pass `defaultValues` to `useForm` to keep TypeScript narrow and prevent uncontrolled→controlled warnings.
- For partial / conditional shapes, prefer `z.discriminatedUnion(...)` over `z.union(...)` — better error messages and narrower types.

## Wizard / multi-step forms

- One schema per step. The wizard's combined schema is a `z.intersection` (or per-step schemas validated independently).
- Persist step values in a feature-scoped store (Zustand) or a `useReducer` in the wizard parent — not in the URL. The URL holds only the active step number.
- Validate step-by-step on "Next" (`form.trigger(['fieldA', 'fieldB'])`), not the whole form.
- Allow free navigation backwards (preserve already-entered values) but block forward navigation past invalid steps.
- A draft / resume pattern lives in localStorage or the backend, not in component state.
- The final submit POSTs the merged payload; the server is the source of truth, not the wizard's local store.

## Field arrays (repeating sections)

- Use `useFieldArray` from react-hook-form for repeating groups (manifest items, line items, contacts).
- Keep an explicit `id` field per row (react-hook-form provides one); never key by index.
- Add / remove buttons live next to the row, not in a top toolbar — users tend to lose track in long lists otherwise.
- Validate per row (each row has its own zod sub-schema) so errors point at the offending row.
- Preserve row order on submit; some backends rely on it.

## Conditional fields

- Conditional rendering is fine, but keep the field's value in the schema as `z.string().optional()` (or `z.literal('').or(...)`) so submit doesn't choke on missing keys.
- Use `useWatch` to drive conditional rendering — do not subscribe to the entire form via `watch()` (re-renders the whole form on every keystroke).
- When a parent field changes, **reset dependent children** (`form.resetField('child')`) so stale values don't sneak through the schema.
- Cross-field validation belongs in zod's `.refine` or `.superRefine`, not in `useEffect` syncing one field to another.

## Server-driven schemas

When the backend owns validation rules (length, regex, allowed values), choose one of:

1. **Generate a zod schema from the OpenAPI contract** at build time (e.g. `openapi-zod-client`). Single source of truth; schema regenerates with the contract.
2. **Server returns a metadata document** (`/api/forms/<name>/schema`) and the client builds the zod schema at runtime. Use when forms change without a frontend release.

Pick one per form family; do not mix.

For (2), validate the schema document itself with a meta-zod schema before constructing fields — never trust an unvalidated schema document.

## Async validation

- For "is this value taken?" checks, use `mode: 'onBlur'` or a debounced async resolver. Never validate async on every keystroke.
- Show a loading indicator beside the field while the async check is in flight.
- Treat 5xx errors as "could not validate" — let the user submit; the server validates again. Do not block submit on a transient async-validation failure.

## Server validation errors

- The shared HTTP error mapper produces `{ message, code, fieldErrors }`. The form's `onSubmit` catches the rejected mutation and walks `fieldErrors` calling `form.setError(field, { type: 'server', message })`.
- Show a top-of-form summary (`role="alert"`, `aria-live="assertive"`) with a count of errors and a link to the first invalid field.
- Field errors stay until the user edits the field — don't clear them on the next keystroke; clear on `change` of that specific field.

## Disabled / submitting state

- Disable the submit button while the mutation is pending. Show a spinner or label change ("Saving...").
- Do **not** disable the form fields — users may still want to correct values.
- After successful submit: redirect, toast, or reset depending on the UX spec. Reset only when the user is expected to enter another record immediately.

## Preserve user input on recoverable failures

- A network error or 5xx must not blow away the form. The form keeps its values; an error region appears at the top with retry.
- A 4xx with `fieldErrors` maps the errors to fields; values stay.
- Only a successful 2xx clears the form (or navigates away).

## Dirty-form navigation guards

- React Router `unstable_useBlocker` (or `useBlocker` once stable) for in-app navigation when the form is dirty.
- `beforeunload` for closing the tab / hard navigation (browser limits the message).
- Use `formState.isDirty` from react-hook-form as the dirty flag.
- The block prompt should let the user discard or stay — never silently navigate away.
- Disable the guard after a successful submit.

## Auto-save / draft recovery

- Auto-save on a debounce (typically 1–2s after the last edit), not on every keystroke.
- Save to the backend (preferred — survives device loss) or to localStorage (keyed by user + form id) when the backend has no draft endpoint.
- Surface the save state visually: "Saving…" → "Saved 12s ago" → "Save failed. Retry."
- On mount, check for a draft and offer "Restore draft" / "Discard" — never silently overwrite the user's empty form.
- Clear the draft after successful final submit.

## Files / uploads

- Use the design-system file-upload primitive (don't roll one).
- Validate type and size with zod (`z.instanceof(File).refine(...)`) before upload.
- Show progress, support cancel, and surface server-side virus-scan or rejection errors as field errors.
- Do not store uploaded `File` objects in TanStack Query cache or Zustand — keep references (URLs / ids returned by the upload endpoint) instead.

## GCC-specific field validation

AD Ports apps collect data from users across the GCC. Common form-field rules that fail under default Western validation:

- **Arabic names** include the Arabic Unicode range (`؀-ۿ`, plus diacritics `ؐ-ؚ`, `ً-ٟ`, presentation forms `ﭐ-﷿`, `ﹰ-﻿`) and may contain spaces. Do not enforce a min-2-words / max-3-words rule — Arabic naming conventions vary widely.
- **Latin transliteration of Arabic names** allows characters like `'` (apostrophe in `Al-Sa'id`), hyphens, and varying word counts. Allow letters + space + apostrophe + hyphen.
- **Phone numbers** — accept E.164 format; do not assume UAE-only. GCC users routinely have multi-country numbers. Validate via `libphonenumber-js` or accept any `+<digits>` and validate server-side.
- **Emirates ID** has a specific 15-digit format with a Luhn checksum (`784-YYYY-NNNNNNN-N`). Client-side validate the **format** with the regex `/^784-\d{4}-\d{7}-\d$/` (strip dashes before checking length = 15). Verify the **checksum** on the server. Do not roll a checksum implementation in the browser — bugs there leak into auth flows.
- **Postal addresses** in the GCC are often unstructured (no postal code in some areas, PO boxes more common than street addresses). Make street/zip optional; require city + emirate/region.
- **Hijri dates** in date pickers — see `references/i18n-and-locale.md` §Hijri calendar. Always render alongside Gregorian.

## Mobile-first

GCC web usage skews mobile-heavy in many AD Ports surfaces (port workers, customs agents on the move). Forms must work on mobile first:

- Touch targets ≥ 44×44 px (iOS HIG / Apple) or ≥ 48 dp (Android Material).
- Use the right `inputmode` (`numeric`, `decimal`, `tel`, `email`) so mobile keyboards open correctly.
- One column on mobile; multi-column only at `md:` breakpoint and above.
- Auto-zoom on iOS triggers when input `font-size < 16px`. Two ways to prevent it: (a) use `text-base` (16 px) on mobile inputs — preferred, preserves user pinch-zoom; (b) set `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">` in the HTML shell — disables user pinch-zoom, an accessibility regression. Prefer (a) unless the design literally cannot use 16 px.
- Test on a real mid-tier device (not just Chrome DevTools), at least once per release.

## Accessibility

- Every input has an associated `<label>` (via `htmlFor` or `aria-labelledby`). The shadcn `<FormLabel>` does this when wired through `<FormField>`.
- Errors are programmatically associated with the field via `aria-describedby`, and the field carries `aria-invalid` when in error.
- The error summary at the top of the form is an `aria-live` region. Screen-reader users hear it on submit.
- Required fields are marked visually **and** semantically (`aria-required="true"` or `required`).
- Tab order matches visual order. The first invalid field receives focus on submit failure.

## Anti-patterns

See `references/anti-patterns.md` §Forms for the canonical list (rejection-citable).
