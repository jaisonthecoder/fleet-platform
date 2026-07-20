# Governance-gated decisions — UI handling (watch-item)

Eight governance decisions (owned outside engineering) gate **production values** for Phase-1 behaviour. The backend already builds the *engine* and holds these values behind named config points / `fixture-…` PDP versions until sign-off. **The app-ui's job is to never hard-code any of these** — it renders whatever the backend PDP/config returns (plus the `policyVersion`), and shows a "provisional — pending sign-off" affordance when a value is still a fixture.

## The rule (applies to every phase)
1. **No gated value is a literal in the UI.** Buffers, max durations, approval chains, eligibility outcomes, thresholds, tolerances, depreciation, recovery and utilisation numbers all arrive from backend responses (PDP `evaluate`, dashboard read models, config endpoints).
2. **Show the source.** Where a decision/threshold drove an outcome, surface the `policyVersion` (and, for fixtures, a small "provisional" chip) so users know the value is engine-driven and whether it is signed off.
3. **The backend is the enforcer.** The UI mirrors — never bypasses — consent gates, SoD, hard-blocks and cost masking. If a value changes after sign-off, the UI needs **no code change**.

## Register

| Decision | Gates | UI surface(s) | UI handling |
|---|---|---|---|
| **D3** — max booking duration / disciplinary escalation steps | `max-booking-duration` rule + escalation ladder | U3 booking wizard (duration validation feedback) | Read the max from the backend response; never assume a number; show the rule's reason on exceedance. |
| **D6** — depreciation config | depreciation rate(s) (Finance) | U7 finance dashboard; vehicle cost fields (U2) | Depreciation shown from backend; edit surface is Finance-only admin config, not a UI constant. |
| **D7** — consent wording (EN + AR) | consent hard-gate content | U3 booking consent step; U5 entitlement consent | Render the backend-provided consent document + `consentDocumentVersion`; do not embed wording in the bundle beyond a labelled v0 fallback. |
| **D8** — dedicated-vehicle eligibility policy | `dedicated-vehicle-eligibility` | U5 entitlement submit (eligibility pre-check) | Show ALLOW/DENY + reasons + `policyVersion` from the PDP; "provisional" chip while on `fixture-…`. |
| **D9** — compliance alert ladders | `compliance-alert-ladders` | U2 compliance runway (alert offsets) | Ladder offsets come from the backend; the UI renders the resulting statuses, not the day counts. |
| **D12** — fines-per-user HR threshold | `fines-hr-threshold` | U5 fines register (HR-alert badge) | The threshold + alert come from the backend; the UI shows the flag the backend raised, not a computed count rule. |
| **D13** — recovery mechanism (payroll) | recovery-instruction export | U5 recovery entry | Phase 1 records the recovery entry only; the UI must not imply payroll execution (that is Phase 2). |
| **D14** — black-point transfer timeframe | `black-point-timeframe` | U2 compliance blocks; U5 fines/black points | Deadline + platform-wide block come from the backend; the UI displays the block state + reason, never the day count as a constant. |

## Also gated (re-consent tolerance, utilisation)
- **Re-consent tolerance** (`consent-re-consent-tolerance`) — U3 detects `consentRecordId === null` after a modify and re-runs consent; it never decides the tolerance itself.
- **Utilisation definition** (D14-adjacent config) — U7 renders the utilisation% the backend read model computes; it does not re-derive the formula.

> Authoritative source of the current values + sign-off status: the backend PDP seed/`policy_version` + `docs/04-planning/implementation-plan-remediation-tracker.md`. This file is the UI-side reminder, not the decision record.
