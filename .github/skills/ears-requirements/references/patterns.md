# EARS Patterns — Full Reference

Table of contents:
1. The universal ingredients
2. Ubiquitous requirements
3. State-driven requirements (While)
4. Event-driven requirements (When)
5. Optional-feature requirements (Where)
6. Unwanted-behavior requirements (If/Then)
7. Complex requirements (combining keywords)
8. Keyword-ordering rules
9. The `shall` convention
10. Cross-domain example library

---

## 1. The universal ingredients

Every EARS requirement is built from up to four parts:

- **Precondition/trigger clause** (optional): the `While`, `When`, `Where`, or `If`
  clause that scopes when the requirement applies.
- **System name** (required): the named entity that must do something. It is the
  grammatical subject and should be a concrete, consistent noun — "the Booking Service",
  not "it" or "the system" if you have several systems in scope.
- **`shall`** (required): the keyword marking a binding obligation.
- **System response** (required): the observable, testable behavior the system must exhibit.

Generic skeleton (brackets = optional):

```
[While <precondition(s)>,] [When <trigger>,] the <system name> shall <system response>.
```

`Where` prefixes this skeleton; `If/Then` is a substitute skeleton for unwanted behavior.

---

## 2. Ubiquitous requirements

**When to use:** the behavior is always active — a fundamental, ever-present property of
the system with no precondition, no trigger, and no optional feature gating it. There is
no keyword. (Do not confuse "ubiquitous" with "important"; it strictly means "no condition".)

**Syntax:**
```
The <system name> shall <system response>.
```

**Examples:**
- The Payment Service shall encrypt all cardholder data at rest using AES-256.
- The Control System shall prevent the engine from exceeding its maximum rated speed.
- The Mobile App shall render all text at a minimum contrast ratio of 4.5:1.
- The Gateway shall record an audit entry for every state-changing request.

**Watch for:** if you find yourself wanting to add "at startup" or "when a request
arrives", it isn't ubiquitous — it's event-driven. Ubiquitous requirements are rarer
than people think; reach for a keyword first.

---

## 3. State-driven requirements (While)

**When to use:** the requirement is active *continuously* for the entire duration that
a specified state or mode is true. The behavior persists across that whole span, not at
a single instant.

**Syntax:**
```
While <precondition(s)>, the <system name> shall <system response>.
```

**Examples:**
- While the vehicle is in motion, the Infotainment System shall disable text entry on the touchscreen.
- While a booking is in the "pending payment" state, the Booking Service shall hold the seat inventory reserved.
- While the aircraft is in flight and an engine is running, the Control System shall maintain fuel flow above the minimum idle threshold.
- While the user session is authenticated, the API Gateway shall attach the tenant identifier to every downstream request.

**Watch for:** "while" answers *"for how long is this true?"* If the answer is "for a
sustained period / a mode", it's state-driven. If the answer is "instantaneously, on an
event", it's event-driven — use `When`.

---

## 4. Event-driven requirements (When)

**When to use:** the requirement is triggered by a discrete, detectable event — an input,
a command, a message arriving, a timer firing, a threshold being crossed, a user action.
The trigger occurs; the system responds.

**Syntax:**
```
When <trigger>, the <system name> shall <system response>.
```

**Examples:**
- When a valid payment authorization is received, the Booking Service shall confirm the reservation within 2 seconds.
- When the user taps "Sign out", the Mobile App shall invalidate the local session token.
- When continuous ignition is commanded by the aircraft, the Control System shall switch on continuous ignition.
- When a message is published to the "order.created" topic, the Fulfilment Service shall create a corresponding shipment record.

**Watch for:** every event-driven requirement needs a clear, observable trigger. "When
appropriate" or "when needed" is not a trigger — it's an omission. Name the exact event.

---

## 5. Optional-feature requirements (Where)

**When to use:** the requirement applies *only when a particular feature, option, or
configuration is present* in the built/deployed system. It scopes behavior to a variant,
edition, license tier, or hardware option — not to a runtime state.

**Syntax:**
```
Where <feature is included>, the <system name> shall <system response>.
```

**Examples:**
- Where the vehicle is fitted with adaptive cruise control, the Control System shall maintain a configurable following distance.
- Where the Enterprise tier is licensed, the Portal shall expose the SSO configuration screen.
- Where the overspeed-protection function is installed, the Control System shall self-test that function at initialization.
- Where the deployment includes the audit module, the Gateway shall stream all access events to the audit sink.

**Watch for:** `Where` is about *configuration/variant presence*, not about a *runtime
condition*. "Where the connection is slow" is wrong (that's a state → `While`, or an
event → `When`). Use `Where` only for things that are either built-in or not.

---

## 6. Unwanted-behavior requirements (If/Then)

**When to use:** the requirement specifies how the system handles an error, fault,
failure, invalid input, disturbance, or any other *undesired* condition. This pattern
exists precisely so that error handling is captured explicitly rather than forgotten —
a leading source of requirement omissions.

**Syntax:**
```
If <unwanted condition or trigger>, then the <system name> shall <system response>.
```

**Examples:**
- If the payment gateway does not respond within 5 seconds, then the Booking Service shall cancel the transaction and release the held inventory.
- If an uploaded file exceeds the size limit, then the Portal shall reject the upload and display the maximum permitted size.
- If the computed airspeed fault flag is set, then the Control System shall use the modeled airspeed value.
- If authentication fails three consecutive times, then the Gateway shall lock the account for 15 minutes.

**Watch for:** keep both keywords — `If … then …`. The condition describes something
that *shouldn't* happen or represents a deviation; the response is the mitigation. If the
condition is actually a *desired* trigger, you want `When`, not `If`.

---

## 7. Complex requirements (combining keywords)

**When to use:** a single requirement legitimately needs more than one qualifier — for
example a trigger that only matters in a particular state, or an optional feature whose
behavior is itself event-driven. Combine the keywords in the same sentence.

**Syntax (most common combination — state + event):**
```
While <precondition(s)>, when <trigger>, the <system name> shall <system response>.
```

**Examples:**
- While the aircraft is on the ground, when reverse thrust is commanded, the Control System shall enable reverse thrust.
- While the vehicle is charging, when the battery temperature exceeds 45°C, the Battery Manager shall reduce the charge current.
- Where the premium plan is active, when a report is generated, the Portal shall include the advanced-analytics section.
- While a checkout is in progress, if the inventory service is unreachable, then the Booking Service shall fall back to the last cached stock count.

**Keep complexity honest.** A complex requirement is still *one* atomic requirement — one
response, one obligation. If you are chaining several responses, you have several
requirements hiding in one sentence; split them.

---

## 8. Keyword-ordering rules

When more than one keyword appears in a requirement, order them consistently so the
sentence reads unambiguously. Recommended precedence, left to right:

```
Where  →  While  →  When / If … then
```

Rationale: `Where` scopes the *configuration* the requirement even exists in; `While`
scopes the *state* during which it is relevant; `When`/`If` scope the *moment* it fires.
Reading outermost-to-innermost keeps the sentence parseable:

> Where <feature>, while <state>, when <trigger>, the <system> shall <response>.

Only include the keywords you actually need — most requirements use zero or one.

---

## 9. The `shall` convention

- Use **`shall`** for every binding requirement. Consistency lets readers and tools
  locate obligations mechanically (grep for "shall").
- Do **not** use `will` (a statement of fact/intent, not an obligation), `should`
  (a recommendation), `must` (ambiguous across audiences), or `may` (permission) inside
  a requirement statement. Reserve those words for surrounding prose if needed.
- Prefer positive obligations. Genuine prohibitions can be written `shall not`
  (e.g. "the Portal shall not store the raw password"), but if the intent is really
  "handle this bad case", express it as an If/Then unwanted-behavior requirement instead.
- One `shall` per requirement. Two `shall`s = two requirements.

---

## 10. Cross-domain example library

**Enterprise / SaaS**
- The Portal shall record an immutable audit log entry for every permission change.
- When an administrator revokes a user's access, the Portal shall terminate that user's active sessions within 30 seconds.
- While a tenant is over its storage quota, the Portal shall reject new file uploads for that tenant.
- Where the compliance add-on is licensed, the Portal shall retain audit logs for seven years.
- If a background export job fails, then the Portal shall retry it up to three times before notifying the tenant administrator.

**Payments / fintech**
- The Payment Service shall settle authorized transactions in the merchant's configured currency.
- When a chargeback notification is received, the Payment Service shall place the associated funds on hold.
- While a merchant account is under review, the Payment Service shall queue payouts rather than releasing them.
- If a transaction is flagged as high-risk by the fraud engine, then the Payment Service shall require step-up authentication before proceeding.

**IoT / embedded (e.g. fleet/carpool telematics)**
- When the vehicle ignition turns on, the Telematics Unit shall begin transmitting location updates every 10 seconds.
- While the vehicle is stationary for more than 5 minutes, the Telematics Unit shall reduce location update frequency to once per minute.
- Where the vehicle is equipped with a fuel-level sensor, the Telematics Unit shall report fuel level with each location update.
- If cellular connectivity is lost, then the Telematics Unit shall buffer readings locally and transmit them when connectivity is restored.

**API / platform**
- When a request arrives without a valid API key, the Gateway shall reject it with HTTP 401.
- While a client is within its rate-limit window, the Gateway shall forward requests to the upstream service.
- If an upstream service returns a 5xx response, then the Gateway shall return HTTP 502 and increment the upstream-error metric.
- Where request tracing is enabled, the Gateway shall propagate the trace context header to all downstream calls.

Notice how, across every domain, the same five shapes recur. Once the pattern is chosen,
the wording almost writes itself — which is the entire point of EARS.
