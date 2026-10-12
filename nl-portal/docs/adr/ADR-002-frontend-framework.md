# ADR-002 — Portal front end: React + Vite single-page application

| | |
|---|---|
| **Status** | Accepted · 04.09.2026 |
| **Context** | PRD §8 recommends React + TypeScript (Next.js). The portal is almost entirely behind login; only three public pages exist (public track and trace, CO2 calculator, sailing schedule) and they are small. The team's experience and the existing MVP are Vite-based. SSR adds a Node rendering tier to host and secure. |
| **Decision** | Build `apps/noatum-customer-portal-ui` as a **Vite SPA** on the design-system tokens. Public pages are part of the same SPA behind the WAF for now. **Re-evaluate before Phase 2 S2.03** (public T&T): if SEO or first-paint on the public pages matters commercially, add a small Next.js app `apps/public-web` for the public pages only, sharing `packages/design-system` and `packages/shared-types`. |
| **Consequences** | One deployment artefact, static hosting, simpler CSP. Public pages are client-rendered until the re-evaluation. This is a documented deviation from the PRD's suggestion, not from its requirements. |
| **Alternatives** | Next.js for everything (accepted PRD default; heavier operations); Remix. |
