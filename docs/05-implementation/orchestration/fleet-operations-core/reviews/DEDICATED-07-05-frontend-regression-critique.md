# DEDICATED-07-05 Critique - Full Frontend Regression Repair

| Date | Decision |
|---|---|
| 2026-07-28 | `CLOSED_NO_BLOCKING_OR_HIGH` |

| Concern | Evidence and disposition |
|---|---|
| Test normalization could affect production. | `resolveApiBaseUrl()` returns `/api` only when Vite `MODE === 'test'`; development/UAT/production resolution remains unchanged. |
| MSW strictness could be relaxed. | `server.listen({ onUnhandledRequest: 'error' })` remains unchanged. The missing consent-context request failed until an explicit handler was added. |
| Worker cap could hide handler leaks. | Handler leaks were fixed first. `maxWorkers: 4` prevents jsdom/transform saturation; the repository-default `pnpm test` uses this committed deterministic configuration. Cleanup/reset handlers remain global. |
| Timeouts could be inflated. | No global test timeout was increased. Existing per-test integration-style limits remain localized. |
| Shell route expectation could be weakened. | Stale Dedicated Coming Soon assertion was moved to authorized Fleet `/operations`, which remains a genuine placeholder and verifies role-aware routing. |

Evidence:

- Previously failing API/Login/App files: 14/14.
- Previously failing App/Dedicated/Vehicle/Vendor files: 35/35.
- Full frontend: 23 files, 107/107 tests.
- Typecheck and production build pass.