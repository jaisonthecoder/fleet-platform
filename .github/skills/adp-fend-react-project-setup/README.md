# adp-fend-react-project-setup

Quick reference for the skill. The full, copy-paste guide lives in [`SKILL.md`](./SKILL.md).

## What it does
Stands up a **production-grade, business-agnostic React + TypeScript SPA** from zero to a green build — build tool, styling, data layer, routing, i18n, cross-cutting concerns, per-environment `.env` files, testing and CI. It adds **no domain/feature screens**.

## When it triggers
- Scaffolding a **new React frontend**, or bringing an **empty** one up to a verifiable baseline.
- Owned by **AI Frontend Engineer (React)** (`ai-frontend-react`).

Do **not** use it to build feature screens — route those to `adp-fend-react-page` / `adp-fend-react-feature` after setup.

## How to invoke
> Use the `adp-fend-react-project-setup` skill. Open `SKILL.md`, run the Intake question round, confirm the stack, then scaffold to a green build.

The skill **interviews the user first** (14-question intake), **confirms the chosen stack**, and **takes the user's suggestions** (swapping libraries/versions adjusts the install commands + version table).

## Intake it will ask (with defaults)
App name & repo layout · package manager · router · styling (Tailwind v4 + shadcn) · server-state lib · forms · i18n + RTL · theming (light/dark) · auth · linter (oxlint/ESLint) · API base/proxy · environments to generate · deploy target · Node version.

## What it generates
- **React 19 + TypeScript (strict)** on **Vite 8**; `tsc -b --noEmit` type gate.
- **Tailwind CSS v4** (CSS-first tokens, light + optional dark) + **shadcn/ui** (Radix) owned in-repo.
- **TanStack Query** + a **typed `fetch` API client** (base-URL aware, RFC-7807 errors).
- **React Router** with **route-level code-splitting** and per-route **error + loading boundaries**; a root **error boundary**.
- **Typed + validated env** (Zod) and per-environment files: `.env`, `.env.development`, `.env.ut`, `.env.production`, `.env.example`, gitignored `.env.local`. Rule: **every `VITE_*` var is PUBLIC — no secrets**.
- **Optional** i18n (react-i18next, EN + Arabic/RTL), auth (MSAL), Docker/nginx static serve, PWA.
- **Tests** (Vitest + Testing Library + MSW), **oxlint + Prettier**, **GitHub Actions CI**.

## Verify (green-build gates)
`pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test` · `pnpm build` · `pnpm build:ut` — all green; routes load as separate chunks.

## Companion skills
`adp-fend-react-scaffold` · `adp-fend-react-component` · `adp-fend-react-page` · `adp-fend-react-tests` · `adp-fend-react-crosscut`. Backend counterpart: `adp-bknd-nest-project-setup`.
