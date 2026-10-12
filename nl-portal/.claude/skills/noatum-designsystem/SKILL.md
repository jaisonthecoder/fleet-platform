---
name: noatum-designsystem
description: Noatum Logistics (AD Ports Group) brand and design system — the authoritative tokens, type scale, component recipes, iconography and brand voice for the Customer Information Platform. Use whenever building or reviewing any UI, email, PDF or public page for this repo (noatum-customer-portal-ui screens, apps/noatum-customer-portal-ui/src/design-system components, branded outputs), or when producing Noatum-branded mocks, prototypes, slides or static HTML. Trigger on colour, font, spacing, radius, button, card, tab, heading, header, footer, stat, news card, badge, brand voice, date format, or any question about what a Noatum surface should look like.
user-invocable: true
---

# Noatum Logistics Design System

> **Authoritative.** This is the same content as `docs/noatum-designsystem.md`, which PRD §8a names
> as the authoritative UI reference. Token values below are copied verbatim and must not be edited
> here — token changes flow from the brand team, never from this project (PRD §2 non-goals).

## USING THIS IN THIS REPOSITORY

`noatum-customer-portal` is a production codebase, not a prototype. Foundation rule 6 in `CLAUDE.md`:

> **Design tokens only.** All colours, fonts, radii, spacing come from
> `apps/noatum-customer-portal-ui/src/design-system/tokens.css` and its components. No hex colour, `font-family` or
> `border-radius` anywhere else. A lint rule enforces this.

So in this repo:

- The CSS token block below is copied **verbatim** into `apps/noatum-customer-portal-ui/src/design-system/src/styles/tokens.css`
  (slice S1.04). Do not rename the custom properties and do not "improve" the values.
- The nine component recipes below are implemented once, in `apps/noatum-customer-portal-ui/src/design-system/src/components/`,
  and exported from `src/index.ts`. Feature code in `apps/noatum-customer-portal-ui/src/features/**` composes them
  and never restyles them.
- App patterns the recipes do not cover (tables, status badges, wizards, timelines, drawers, the
  Grid/Detail/Card `DataView`) are built in the design-system package under the same rules.
- **Status colours** are an app-specific extension, not part of the brand set: brand red is the
  primary action colour, so statuses must not compete with it. Use success green (`#2E7D32` class),
  warning amber, informational navy `#002C5F`, neutral grays; destructive and error reuse brand red
  sparingly. This extension is pending brand-team ratification (OQ-14).
- **Cards and sections are square** (`--radius-none: 0`). Only buttons and inputs get 4px. This is
  the rule most often broken by habit — check it in review.
- The brand voice rules below apply to **every** customer-facing string**:** UI microcopy,
  notifications, emails, quote and report PDFs, and chatbot output. No emoji, no exclamation marks,
  dates `DD.MM.YYYY`. Money always shows the currency code with the amount, never a symbol alone.
- Every string is localised EN + ES via i18next. A missing Spanish key is a failing build.
- Accessibility is WCAG 2.1 AA. Brand red `#AA272F` on white passes AA for normal text (≈ 6.9:1);
  **muted gray `#A7A7A6` fails AA for body copy and is decorative or meta only.** Verify contrast
  wherever red text sits on the `#F5F5F3` section surface.

For throwaway mocks, prototypes and slides, output static HTML using the tokens directly — the same
values, no build step needed.

---

Design system for **Noatum Logistics** (noatumlogistics.com), the global freight-forwarding and logistics division of **AD Ports Group** (headquartered Coslada, Madrid). Top-50 global freight forwarder: air freight, ocean freight, inland transport, customs brokerage, warehousing & distribution, and value supply chain management, plus industry solutions (automotive, chemicals, pharma, retail, etc.).

This file is self-contained: every token and rule needed to design for the brand is inlined below. If the full design-system folder is available alongside it, prefer its `styles.css`, `assets/`, and `components/` (see INDEX at the end).

## HOW TO USE
- Creating visual artifacts (slides, mocks, throwaway prototypes): output static HTML using the CSS tokens below.
- Working on production code: apply the tokens and rules directly in the codebase's styling system.
- Invoked with no other guidance: ask what the user wants to build, ask a few questions, then act as an expert Noatum brand designer.

## CSS TOKENS
```css
:root {
  /* Base palette — sampled from noatumlogistics.com */
  --red-600: #AA272F;   /* Noatum brand red */
  --red-700: #8E2027;   /* hover / pressed */
  --red-050: #F7ECEC;
  --navy-800: #002C5F;  /* logo navy */
  --navy-950: #041C2C;  /* hero overlay navy */
  --gray-900: #333333;
  --gray-700: #58595B;
  --gray-400: #A7A7A6;
  --gray-200: #E5E5E5;
  --gray-100: #F5F5F3;
  --white: #FFFFFF;

  /* Semantic aliases */
  --color-primary: var(--red-600);
  --color-primary-hover: var(--red-700);
  --color-accent-navy: var(--navy-800);
  --text-heading: var(--gray-900);
  --text-body: var(--gray-700);
  --text-muted: var(--gray-400);
  --text-on-dark: var(--white);
  --surface-page: var(--white);
  --surface-section: var(--gray-100);
  --surface-card: var(--white);
  --surface-footer: var(--red-600);
  --surface-topbar: var(--red-600);
  --border-subtle: var(--gray-200);
  --link: var(--red-600);
  --link-hover: var(--red-700);

  /* Typography (Mulish substitutes the proprietary site font) */
  --font-sans: 'Mulish', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  --text-display: 800 42px/1.25 var(--font-sans);   /* hero H1 */
  --text-h2: 800 34px/1.25 var(--font-sans);        /* section titles */
  --text-h3: 700 24px/1.3 var(--font-sans);         /* card / sub titles */
  --text-h4: 700 19px/1.35 var(--font-sans);
  --text-eyebrow: 700 17px/1.3 var(--font-sans);    /* ALL-CAPS kicker over hero H1 */
  --text-nav: 700 17px/1.2 var(--font-sans);
  --text-body-f: 400 16px/1.6 var(--font-sans);
  --text-small: 400 14px/1.5 var(--font-sans);
  --text-stat: 800 40px/1.1 var(--font-sans);       /* red counters */
  --text-footer-heading: 800 16px/1.3 var(--font-sans); /* ALL-CAPS */
  --tracking-caps: 0.02em;

  /* Spacing & shape */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
  --space-9: 96px;
  --container-max: 1170px;
  --radius-btn: 4px;    /* buttons, inputs */
  --radius-none: 0;     /* cards and sections are square */
  --shadow-card: 0 2px 14px rgba(0,0,0,0.10);
  --heading-rule-w: 40px;   /* signature red dash under headings */
  --heading-rule-h: 3px;
}
```
Font load: `@import url('https://fonts.googleapis.com/css2?family=Mulish:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');`

Base rules: body uses `--text-body-f` in `--text-body` color on white; links are brand red, underline on hover; headings are `--text-heading`.

## CONTENT FUNDAMENTALS
- Voice: confident, service-led B2B. "We" for Noatum, "you/your" for the client: "We ensure seamless supply chain operations for your air logistics needs."
- Benefit-first sentences with concrete operational nouns (space allocation, competitive rates, customs clearance, last mile).
- Headlines are plain sentence case with a terminal period on brand statements: "From Noatum Logistics to anywhere in the world." / "Global Logistics Excellence with a Customer-Centric Approach."
- ALL-CAPS is reserved for eyebrows/kickers ("GLOBAL TRANSPORT & LOGISTICS SOLUTIONS") and footer column headings ("LOGISTICS SERVICES").
- Branded hashtag: **#EnablingTrade**.
- Dates formatted `DD.MM.YYYY` (22.05.2026). News teasers end with an ellipsis; links read "Read more…", "Read all news...".
- No emoji, no exclamation marks, no jokey copy. English (US site) + Español mirror.

## VISUAL FOUNDATIONS
- **Color:** one brand red `#AA272F` doing nearly all accent work — top bar, footer, buttons, links, icons, stats, heading rules. Deep navy `#002C5F` lives almost only in the logo and dark hero imagery. Text is charcoal `#333333` / gray `#58595B`. Alternating section backgrounds: white and warm light gray `#F5F5F3`. Max 2 background colors per page plus the red footer.
- **Type:** single humanist sans for everything (site webfont is proprietary; **Mulish** substituted — see caveats). Heavy weights (700–800) for all headings and nav; regular 400 body. No serifs, no italics except rare emphasis.
- **Signature motif:** a short red rule (40×3px) under section headings — left-aligned under left-aligned headings, centered under centered ones.
- **Imagery:** full-bleed photography — dark blue "global network" hero imagery, operational photos (flags, ports, warehouses). Cool/blue color cast. Text over imagery is white on the dark navy end of the photo; no gradient capsules.
- **Layout:** ~1170px centered container; generous vertical section padding (64–96px); stats in a 6-up centered row; news as 1 featured card + stacked list rows.
- **Cards:** square corners, white, soft shadow `0 2px 14px rgba(0,0,0,.10)`, no border. Buttons/inputs: 4px radius.
- **Borders:** hairline `#E5E5E5` for nav divider, input borders, list-row separators.
- **Hover:** links turn/keep red with underline; buttons darken to `#8E2027`. No scale/bounce effects. Transitions are plain, fast fades.
- **Footer:** solid brand red, white text, ALL-CAPS column headings with a white underline rule, `›` list markers, white logo.
- **No** gradients (outside photography), no rounded feature-cards, no transparency/blur effects.

## COMPONENT RECIPES
- **Button** — primary: solid `--color-primary` bg, white bold 16px label, `11px 24px` padding, 4px radius, darkens to `--red-700` on hover. Outline: white bg, 1px `--color-primary` border, red label (header "Get a quote"). No other variants.
- **SectionHeading** — heavy heading + the 40×3px red rule 14px below, rule follows text alignment.
- **StatCounter** — centered column: red thin-line icon (56px), `--text-stat` red number, 32×2px red divider, bold 17px red label. Used in a 6-up row.
- **Input / Select** — white, 1px `--border-subtle` border, 4px radius, `11px 14px` padding; muted placeholder; label above in body gray.
- **Tabs** — folder-style on a white shadowed card: active tab white and merged into the panel, inactive light gray `#E5E5E5` with hairline bottom border. Bold 17px labels (hero "Customer Area / Get A Quote").
- **NewsCard** — featured: image top (6:5 crop), white card with shadow, bold title, small excerpt, muted `DD.MM.YYYY` date with small red calendar glyph. Row: 175px thumb left, hairline top separator, date, bold 19px title, small excerpt.
- **Header** — red top bar (utility nav, white 14–15px), white logo band, white main nav (bold 17px charcoal links) with hairline bottom border, outline "Get a quote" button right.
- **Footer** — brand red; link columns with `›` markers; address block with white logo; thin top-border strip for copyright/legal.

## ICONOGRAPHY
- Thin-stroke red (`#AA272F`) line icons for stats/features (globe, handshake, map pin, buildings, warehouse, people).
- Small utility glyphs (calendar next to dates, lock in Continue button, envelope in Get a quote) in the current text color.
- `›` unicode chevrons as list markers in the footer. No emoji anywhere.
- For new icons, use a thin-stroke line set (e.g. Lucide at stroke 1.5, colored `var(--color-primary)`) — a flagged substitution for the site's own SVG set.

## CAVEATS / SUBSTITUTIONS
- **Font:** live-site webfont is proprietary and was not retrievable; Mulish (Google Fonts) is the substitute. Swap in original font files when provided.
- **Logo:** original SVGs (`Noatum-Logistics-RGB.svg`, `Noatum-Logistics-WHITE-RGB.svg`) were not retrievable; never redraw the logo — use provided assets or plain type. In the full folder, `assets/logo-color.png` (white bg) and `assets/logo-white-on-red.png` (red bg baked in) are screenshot crops.
- Stats icons in `assets/` are low-res screenshot crops; originals are SVG.

## INDEX (full design-system folder, when present)
- `styles.css` → imports `tokens/` (fonts, colors, typography, spacing, base)
- `assets/` — logos, red line icons, world map, hero + brand photos
- `components/core/` — Button, SectionHeading, StatCounter
- `components/forms/` — Input, Select
- `components/navigation/` — Tabs
- `components/content/` — NewsCard
- `ui_kits/website/` — homepage recreation (Header, Hero, Home, Footer)
- `guidelines/cards/` — foundation specimen cards
