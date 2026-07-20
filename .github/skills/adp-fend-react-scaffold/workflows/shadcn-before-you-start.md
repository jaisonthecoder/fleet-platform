# Workflow — Before You Start

Run this checklist before scaffolding, extending, or applying the kit. Every item must pass or be explicitly waived. If something fails, **stop** and fix it — don't proceed and hope.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
Open `SKILL.md`, identify whether the task is scaffold, showcase, extension, or feature application, and confirm the project root before inspecting files.

## Goal

Confirm the project is in a state where the skill can do useful work. Catch missing prerequisites *before* writing files.

## Steps

### Project shape

- [ ] **Framework detected.** Read `package.json`. Confirm one of: `next` (App or Pages Router), `vite`, `@remix-run/*`, `astro`. If none, ask the user which framework — don't guess.
- [ ] **Node at the recommended baseline.** Use the LTS recorded in `/standards/framework-baselines.md` § Node.js. Check with `node -v`. shadcn CLI requires a current LTS.
- [ ] **Package manager identified.** Look for `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb` / `package-lock.json`. Use the matching command throughout.
- [ ] **TypeScript present.** `tsconfig.json` exists. shadcn-kit is TS-only.
- [ ] **`@/*` path alias set.** Check `tsconfig.json` `compilerOptions.paths`. If missing, add it. (Vite also needs it in `vite.config.ts`.)

### Tailwind

- [ ] **Tailwind installed.** `tailwindcss` in `package.json`. If not, install **Tailwind v4**: `pnpm add -D tailwindcss @tailwindcss/postcss postcss`.
- [ ] **Tailwind version recorded.** `pnpm why tailwindcss` → note v3 or v4. Templates differ; pick the right one.
- [ ] **PostCSS configured.** `postcss.config.{js,mjs,ts}` exists or v4's PostCSS plugin is wired.
- [ ] **Content globs include the source dirs.** v3: `tailwind.config.ts` `content`. v4: nothing — Tailwind v4 auto-discovers.

### shadcn

- [ ] **`components.json` present.** If not, run `pnpm dlx shadcn@latest init` — answer the prompts, but **stop after init** and return to this checklist.
- [ ] **Style chosen.** `components.json` → `style: "new-york"` (kit default) or `"default"`. Document choice in `UI_KIT.md`.
- [ ] **Aliases match `tsconfig.json`.** `components.json` `aliases.*` use `@/...`; `tsconfig.json` `paths` resolve `@/*` to the same root.
- [ ] **Icon library set.** `components.json` → `iconLibrary: "lucide"` (kit default). If brand mandates a different library, set it but be aware: every section's icon usage will need a matching library import.

### Existing kit inventory

- [ ] **List `components/ui/`.** `ls components/ui/` (or `src/components/ui/`).
- [ ] **For each existing component, decide:** keep / overwrite / merge.
   - **Keep:** never re-run `shadcn add` on it. Note in `UI_KIT.md` "Hand-authored additions".
   - **Overwrite:** confirm with user — `shadcn add` overwrites without backup. Show the diff if possible.
   - **Merge:** rare — only if the existing component has critical project-specific code. Manually port the code into the freshly-installed file.
- [ ] **List existing `app/ui-kit/` (if any).** If the showcase exists from a prior run, default to **extend** (`extend-kit.md` workflow), not re-scaffold.

### Tokens

- [ ] **Source identified.** Where do tokens come from? Options:
   1. A brand spec doc (e.g. `docs/specs/<brand>-design-system.md`) — preferred
   2. A designer's filled `tokens.css` — copy it
   3. Nothing yet — generate the blank template and **stop**, hand off to the user/designer to fill, re-invoke when filled
- [ ] **If token file exists, validate:**
   - Every variable from [`references/tokens-spec.md`](../references/tokens-spec.md) §"Required variables" is present
   - No placeholder marker strings remain
   - Every color value parses (run a CSS-parse check or eyeball)
   - Light + dark both defined for every brand / neutral / semantic / surface token

If validation fails, stop. Surface the missing variables to the user.

### Dark mode + RTL

- [ ] **Dark mode requirement confirmed.** `required` / `optional` / `none`. Default `optional` (light + dark generated, toggle wired up but kit works without it).
- [ ] **RTL requirement confirmed.** `required` / `optional` / `none`. Default `optional`. If the project serves Arabic/Hebrew/Farsi/Urdu users, this is `required`.

### Repo state

- [ ] **Working tree is clean** (`git status`). The skill writes many files; mixing them with unrelated changes makes review impossible.
- [ ] **You're on a feature branch**, not `main` / `master`. `git branch --show-current`.

## Anti-patterns

- ❌ Running `shadcn add` to "see what happens" before this checklist completes. shadcn writes files immediately and overwrites without prompting.
- ❌ Generating tokens.css with placeholder colors "to see the layout." The Foundations section will display contrast warnings; the kit looks broken; everyone loses confidence in the kit before it's been fairly tested.
- ❌ Skipping the existing-kit inventory. Overwriting a hand-tuned `Button.tsx` with the default version costs hours to recover from.
- ❌ Starting on `main`. Even with auto mode, the kit scaffold is a multi-file change that deserves its own PR.

## After you finish

Record the detected framework, Tailwind version, shadcn style, token path, package manager, and any waived prerequisite before moving to another workflow.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- Every checkbox is checked or explicitly waived (with the user's confirmation in chat).
- A summary message to the user states: framework, package manager, Tailwind version, shadcn style, dark mode mode, RTL mode, tokens source, existing-kit inventory.
- Either: tokens are validated and ready (proceed to `scaffold-kit.md`), OR the blank template was generated and the workflow exits with "fill these N variables, then re-invoke me."
