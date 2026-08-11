# Phase 7 — Help Center & FAQ

**Goal:** A dedicated help center with browsable, bilingual FAQ and guides, contextual "?" help on screens, and reason-linked articles so every block can point to a "why & how to fix" page. Content is admin-authorable without a deploy.

**Scenarios:** S-70, S-71, S-72, S-73, S-74
**Features:** F-70, F-71, F-72, F-73, F-74, F-54

---

## In scope
- Help center page + topic navigation; FAQ content model (bilingual, categorized); contextual help affordances; reason → article deep links; admin authoring.

## Out of scope
- Live chat / ticketing (future); AI answer bot (separate "Ask AI" track already stubbed in header).

## DB
- Migration: `fleet.help_article` (§03 1.6) with `slug`, `category`, `locale`, `title`, `body_md`, optional `reason_code`, `published`. Seed a starter set (booking, dedicated, credentials, handover, common blocks). Rollback drops table.

## Backend
- `HelpModule`:
  - `GET /v1/help/articles?category=&reasonCode=&locale=` (published only for non-admin).
  - Admin CRUD `/v1/admin/help/articles` (SystemAdmin/DataSteward).
- Content is markdown; render safely on the client.

## Frontend
- **Help Center** page `/:lang/help`: topic sidebar + article view + search; bilingual.
- **Contextual help**: a reusable `HelpLink`/`?` affordance that opens the relevant article (by slug or `reasonCode`); embed on booking/dedicated/handover screens and on block messages (from P1/P5).
- Admin authoring screen (basic markdown editor + publish toggle).
- Wire an entry point from the header/nav.

## Contracts / guards
- `HelpArticleDto` → `guard:contracts:update`; org-scoped → `guard:org` allowlist.

## Tests
- BE: list filters (category/reasonCode/locale, published visibility); admin CRUD RBAC.
- FE: help center browse/search; contextual `?` opens correct article; reason → article mapping; RTL.

## Acceptance criteria
- Users can browse a bilingual help center and find FAQs by topic.
- Every block reason can deep-link to a relevant help article.
- An admin can add/edit an FAQ without a code deploy.

## Dependencies
Parallelizable with P1–P6; reason links integrate best after P1/P5 and alongside P8 reason catalog.
