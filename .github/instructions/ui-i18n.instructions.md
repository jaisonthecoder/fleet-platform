---
applyTo: "app-ui/src/**/*.{ts,tsx}"
---

# UI translation (i18n) rules — app-ui

Translations are mandatory for every UI component in `app-ui`. When creating or
editing any component, page, or shared UI, you MUST:

## Strings
- Never hardcode user-facing text. Use `react-i18next`: `const { t } = useTranslation()` and `t('namespace.key')`.
- Add every new key to BOTH catalogs, kept in sync:
  - `src/i18n/locales/en.json`
  - `src/i18n/locales/ar.json`
- Group keys by feature/area (e.g. `common.*`, `nav.*`, `home.*`, `booking.*`). Reuse existing keys before adding new ones.
- Legal/consent/compliance copy must exist in English AND Arabic.

## Locale is URL-based
- The active language lives in the URL: `/:lang` (e.g. `/en`, `/ar`). `LocaleRoute` (in `src/app/routing/router.tsx`) reads it and syncs i18next.
- Do NOT set language from ad-hoc component state or call `i18n.changeLanguage` directly in feature code. To change language, navigate to the locale-prefixed URL (see the header `LanguageToggle`).
- Keep internal links locale-aware: build paths from the current `:lang` param (e.g. `/${lang}/bookings`) or use the shared nav table.

## RTL (Arabic)
- Use Tailwind **logical** utilities only: `ps-*`/`pe-*`, `ms-*`/`me-*`, `start-*`/`end-*`, `text-start`/`text-end`. Never hardcode `left`/`right` (or `ml-`/`mr-`/`pl-`/`pr-`) for directional layout.
- `dir`/`lang` on `<html>` are handled centrally (`app-providers`); don't set them per component.
- Keep IDs, plates, and numeric codes LTR-isolated inside RTL text (`<bdi>` / `unicode-bidi: isolate`).

## Formatting
- Format user-facing numbers, dates, and currency with `Intl.*` per active locale rather than manual string building.

## Before finishing
- Run `pnpm --filter app-ui typecheck && pnpm --filter app-ui test`.
- Confirm the component renders correctly in both `/en` and `/ar` (LTR and RTL).
