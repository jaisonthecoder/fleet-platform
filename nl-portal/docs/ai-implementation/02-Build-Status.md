# Build status

> Last verified 22.09.2026. Update the date and §5 when you touch this.

## 1. At a glance

| | |
| --- | --- |
| API typecheck | passing |
| UI typecheck | passing |
| Endpoint in OpenAPI | **no — not regenerated** |
| UI strings | **17 missing in EN and ES** |
| Gemini key configured | **no** |
| Tested end to end | **no** |

Working but not yet usable. The three gaps above are §5.

## 2. Files — the whole feature

### API — `apps/noatum-customer-portal-api/src/modules/ai-intake/`

| File | Purpose |
| --- | --- |
| `intake-rules.ts` | The deterministic layer. Volume to equipment, Incoterm to scope, hazard detection, gap questions. Pure functions. |
| `gemini-intake.client.ts` | The only file that knows about Google. Plain `fetch`, no SDK, no new dependency. 25 s timeout. Reads the key from `process.env` so no config file is touched. |
| `ai-intake.service.ts` | Joins the model to the rules. Resolves container, hazard and Incoterm codes against the lookups so an invented code cannot reach the form. |
| `ai-intake.controller.ts` | `POST /api/ai/quote-intake` and `GET /api/ai/quote-intake/availability`, plus the DTOs. |
| `ai-intake.module.ts` | Wiring. Imports `ReferenceModule` for the lookups. |

Both routes carry `@RequirePermission(PERMISSIONS.QUOTES_CREATE)` and
`@RequireFeature('quotations.ai_intake')`.

### UI — `apps/noatum-customer-portal-ui/src/features/ai-assistant/`

| File | Purpose |
| --- | --- |
| `IntakePanel.tsx` | Collapsed teaser, upload and paste, results read-back, the questions list. |
| `IntakePanel.module.css` | Tokens only. |
| `api/aiIntake.ts` | The query hook and the base64 encoding of the chosen file. |

### Touched elsewhere — the entire removal surface

| File | Change |
| --- | --- |
| `src/app.module.ts` | `AiIntakeModule` added to imports |
| `src/contracts/feature-switches.ts` | `quotations.ai_intake` catalogue entry |
| `QuoteRequestPage.tsx` | `<IntakePanel>` behind `useFeature`, plus `applyIntakeDraft` and `applyIntakeAnswer` |
| `en-US.json` / `es-ES.json` | panel strings (**not yet added**) |

**No migration. No schema change. Nothing persisted.**

## 3. Configuration

```
# apps/noatum-customer-portal-api/.env.local   — never committed
AI_ASSISTANT_API_KEY=<gemini key>
AI_ASSISTANT_MODEL=gemini-2.0-flash
```

Free key from <https://aistudio.google.com/app/apikey>. The API must be restarted
after adding it.

**Two independent gates**, both deliberate:

1. the switch `quotations.ai_intake` — default off, turned on from the Feature
   management screen;
2. the key — absent means the endpoint reports `not-configured` and the panel
   hides itself.

So a machine with no key still runs the portal normally, and the demo can show
the switch being turned on as its own beat.

## 4. How to run it

1. Add the key, restart the API.
2. Sign in as a customer. To create one:
   `$env:NODE_ENV='development'; node --env-file=.env.local scripts/seed-demo-customer.cjs`
   which prints single-use `/invitation/<token>` links.
3. Feature management, turn on **AI quote intake**.
4. `/app/quotations/new`, upload an invoice.

Dev ports for this project are **45173** (UI) and **43000** (API), not 5173/3000.

## 5. What is left — resume here

### 5.1 Add the 17 UI strings

`IntakePanel.tsx` calls these and neither bundle has them, so the panel currently
renders raw keys:

```
aiTeaser  aiStart  aiTitle  aiHint  aiClose  aiUpload  aiOr  aiPaste
aiPastePlaceholder  aiRead  aiReading  aiNotConfigured  aiUnreadable
aiFilled  aiQuestions  aiUseAnswer  aiProvenance
```

EN and ES both. No emoji, no exclamation marks.

### 5.2 Regenerate the contract

`openapi.json` has no `/api/ai/quote-intake`, so the generated client does not
know the route. `api/aiIntake.ts` currently works around this with `as never`
casts — **remove them once the contract is regenerated**, or the first shape
change will pass typecheck and fail at runtime.

```
pnpm --filter noatum-customer-portal-api run openapi:generate
pnpm --filter noatum-customer-portal-ui run api:generate:offline
```

### 5.3 Test end to end

Against `INV-2026-006` (clean sea FCL) and `INV-2026-011` (lithium batteries,
UN 3480, Class 9, temperature monitoring). Expect the first to propose a 20ft and
the second to raise the DG flag, carry UN 3480 and Class 9, and ask for the
reefer set point.

## 6. Before this could face a real customer

Not needed for the demo. Needed before anyone points it at a live account.

| Gap | Note |
| --- | --- |
| **Privacy sign-off** | A commercial invoice carries unit prices and trading partners. Sending it to Google means customer commercial data leaving our tenancy and region. The switch is `requiresApproval: true` for this reason. Demo with fictional invoices only. |
| **ADR for the inline call** | Foundation rule 2 says external systems are called from jobs. There are three recorded exceptions; this is a fourth and is not yet recorded. Same shape as the instant-rate exception: user-facing, hard timeout. |
| **Tests** | None written. At minimum: the rules table, a 403 when the switch is off, and a check that the endpoint persists nothing. |
| **Upload hardening** | No magic-byte check, no size cap enforced server-side. |
| **Port verification** | There is no UN/LOCODE lookup, so an extracted port cannot be checked against our own data. Adding a `port` lookup would also fix the request form's unverified origin and destination. |
| **Per-customer entitlement** | Currently a platform switch only. Should also be a `customerGroup.feature_flags` entitlement. |

## 7. Decisions taken, so they are not silently reversed

| Decision | Why |
| --- | --- |
| Rules in TypeScript, not in the prompt | Explainable, stable, and a model cannot invent a code that reaches the form. |
| `fetch` rather than the Google SDK | No dependency, no lockfile churn, lifts out cleanly. |
| Key read from `process.env`, not `ConfigService` | Keeps `env.validation.ts` and the config factory untouched, so removal is smaller. |
| Base64 in JSON rather than multipart | No file interceptor, no multer wiring, less to remove. |
| Nothing persisted | No migration means no reverse migration. |
| The draft fills empty fields only | A customer's own answer is never replaced by a machine's. |
