# DEDICATED-01 Critique Round 3 - UX, Accessibility and Operations

| Field | Value |
|---|---|
| Date | 2026-07-25 |
| Scope | Live configured eligibility, optional Vehicle preference, My Requests and manual administration |
| Decision | `CLOSED_NO_BLOCKING_OR_HIGH` |

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D01-R3-01 | High | Stale 409 lacked actionable recovery. | Closed with localized guidance, refresh action and preserved unsaved values. |
| D01-R3-02 | High | Disabled WithDriver reason was not programmatically associated. | Closed with `aria-describedby`. |
| D01-R3-03 | High | Preference character count was not announced. | Closed with semantic `output` and polite live updates. |
| D01-R3-04 | Medium | Controls remained editable during mutation. | Closed with a disabled fieldset during create/update. |
| D01-R3-05 | Medium | Arabic and responsive proof was missing. | Closed: focused Arabic test plus live EN/AR checks at 320/768/1024/1440; no content overflow. RTL 320px inline-start offset is the browser scrollbar, not layout overflow. |
| D01-R3-06 | High | Raw policy reason codes and stale policy-pending copy could surface to Employees. | Closed: EN/AR configured-eligibility copy and known ALLOW/DENY/class/approval reason translations added. |
| D01-R3-07 | Medium | Manual fallback operability was unproven. | Closed: live Reference Data shows four categories/two classes; Policy Studio shows direct facts, editable ALLOW JSON, simulation and mandatory DENY default. |
| D01-R3-08 | Medium | Full frontend suite remains noisy from unrelated pre-existing MSW base-URL failures. | Accepted for this phase: isolated Dedicated tests pass 5/5 and production build passes; unrelated suite failures are not suppressed. |

Live browser edit through PATCH displays the updated preference and eligibility-invalidation notice. Independent closure review found no remaining Blocking/High UX finding.