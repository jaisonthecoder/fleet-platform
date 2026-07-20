# Phase 3 — Form Fields & Validation

> **Status:** ✅ Implemented (core) — RHF + Zod Form/Field layer + Input, Textarea, Select,
> Checkbox, Radio, Switch, Slider, Segmented, Combobox, Calendar/DatePicker. Reference form +
> validation tests in `/:lang/design`. Follow-ups: date-range, time, file-upload, multiselect, tag input.

> **Goal.** Ship the complete form system: a **React Hook Form + Zod** wiring layer, a consistent
> **Field** wrapper (label + control + description + error), and **every form control** — all
> shadcn/Radix-based, Wayfinder-skinned, validated, accessible, RTL, i18n. This is the backbone for
> Booking consent, Handover, Entitlement request, Policy authoring, Admin.

Prereq: `00_Overview`. Deps already present: `react-hook-form`, `@hookform/resolvers`, `zod`.
Deps to add: `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`, `@radix-ui/react-switch`,
`@radix-ui/react-slider`, `react-day-picker`, `date-fns`.

---

## 3.1 Form architecture — `components/form/`

- **`Form`** = thin wrapper over RHF `FormProvider` (shadcn `form` pattern): `Form`, `FormField`,
  `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`.
- **Validation:** **Zod** schemas per feature; `zodResolver`. Schema is the single source of truth
  for rules + types (`z.infer`). Validation mode `onTouched`, re-validate `onChange`.
- **Field wrapper** binds label ↔ control ↔ description ↔ error via `id`/`aria-describedby`/
  `aria-invalid`. Error text uses `--danger` + icon; required marked with an accessible indicator.
- **i18n:** labels/placeholders/errors resolved by the consumer via `t()`; Zod messages mapped to i18n keys.
- **Submit:** disabled-until-valid pattern where relevant; loading state on the submit `Button`.

## 3.2 Controls (all in `components/ui/`, re-skinned)

| Control | Base | Notes |
|---|---|---|
| **Input** | exists | add invalid state (`aria-invalid` → danger border/ring), sizes, prefix/suffix slots, `.font-data` variant for plates/IDs |
| **Textarea** | exists | auto-grow option, counter, invalid state |
| **Select** | exists (Radix) | groups, disabled items, invalid state, placeholder styling |
| **Combobox** | `cmdk` + Popover | single-select searchable (pools, vehicles, cost centres) |
| **Multiselect / tokens** | `cmdk` + Popover + Badge | multi-select with removable chips |
| **Checkbox** | `@radix-ui/react-checkbox` | single + **CheckboxGroup**; token check (`--brand`), invalid state |
| **Radio group** | `@radix-ui/react-radio-group` | vertical/horizontal; used for request-type choices |
| **Switch** | `@radix-ui/react-switch` | on = `--brand`; labelled; for toggles/feature flags |
| **Segmented control** | button group | Helm uses this (Long-term/Temporary, With/Without driver, Handover/Return tabs) — active = `--brand` fill |
| **Slider** | `@radix-ui/react-slider` | fuel level, thresholds; token track/thumb; keyboard steps |
| **Number input** | Input + stepper | integer/decimal, min/max/step, tabular figures |
| **Date picker** | `react-day-picker` + Popover | single date; `date-fns` + locale (en/ar), RTL calendar |
| **Date-range picker** | `react-day-picker` range | booking windows |
| **Time picker** | Input mask / select | pick-up/return times (`09:00`) |
| **File upload / dropzone** | input[type=file] + drag | damage photos, documents; preview, size/type validation, progress (Phase 1) |
| **Tag input** | Input + Badge | free-form tags/plates |
| **Label** | exists | required marker, `htmlFor` wiring |

## 3.3 States (every control)

default · focus-visible (2px `--ring` + offset) · filled · **invalid** (`--danger` border + ring +
message + `aria-invalid`) · disabled · readonly · loading (async selects) · with help text.

## Design / token mapping

| Element | Tokens |
|---|---|
| Field bg / border | `bg-surface-2` (inputs) or `bg-background`; `border-border` (`#E0DACB`); focus ring `--ring` |
| Label / help | `text-muted-foreground` (label), `text-ink-3` (help) |
| Invalid | `border-destructive`, `ring-destructive`, message `text-destructive` + icon |
| Checkbox/radio/switch on | `--brand` (`accent-color`/fill), `--brand-foreground` check |
| Segmented active | `bg-brand text-brand-foreground` (matches Helm) |
| Radius / height | 3px; controls 44px touch target on mobile, ~40–44px desktop |

## Tasks

- [ ] `components/form/` (Form + Field primitives) on RHF; Zod resolver + i18n message mapping helper.
- [ ] Add Radix deps; build Checkbox(+group), RadioGroup, Switch, Slider, SegmentedControl.
- [ ] Combobox + Multiselect (cmdk + Popover + Badge).
- [ ] DatePicker + DateRangePicker + TimePicker (react-day-picker + date-fns, en/ar locales, RTL).
- [ ] NumberInput, FileUpload/dropzone, TagInput; upgrade Input/Textarea/Select invalid states.
- [ ] A **reference form** in the showcase (all controls + validation) in both themes + RTL + Arabic.
- [ ] Tests: validation triggers + messages; keyboard on checkbox/radio/switch/slider; date picker selection + locale.

## Exit checklist

- [ ] A Zod-validated reference form submits only when valid; errors are announced + `aria-invalid` set; RTL correct.
- [ ] Every control themed in light + dark, keyboard-operable, i18n-driven copy.
- [ ] Date/range/time pickers localise (en/ar) and mirror in RTL.
- [ ] Gate green.
