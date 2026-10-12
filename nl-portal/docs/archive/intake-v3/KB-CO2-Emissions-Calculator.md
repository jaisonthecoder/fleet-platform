# KB Note — CO2 Emissions Calculator (FG-9.1, FG-1.4, FG-3.2)

| | |
|---|---|
| **Topic** | How shipment CO2 is calculated and how we will implement it |
| **Related PRD items** | FG-9.1 public CO2 calculator · FG-1.4 CO2 visibility in T&T · FG-3.2 predicted CO2 at booking · OQ-11 methodology decision |
| **Phase** | P4 — Intelligence & Analytics |
| **Status of decision** | Open (OQ-11, owned by Sustainability + Legal) |
| **Written** | 03.09.2026 |
| **Audience** | Team members new to logistics — written in plain English |

---

## 1. What the feature is

When goods move by ship, plane or truck, fuel is burned and CO2 is released. Customers increasingly want a number: "how many kilograms of CO2 did my shipment cause?"

The platform must show this number in three places, all powered by **one** calculation service:

| Where | Login needed | When it is calculated | Label |
|---|---|---|---|
| Public CO2 calculator (standalone web tool) | No | User enters origin, destination, mode, weight | Estimate |
| Booking wizard | Yes | Once route and cargo steps are filled in | Predicted |
| Track & Trace shipment detail and grid column | Yes | Recalculated when legs change; final version when shipment closes | Predicted → Final |

The public calculator should compare modes side by side (air vs sea FCL vs sea LCL) and highlight the lowest-CO2 option. "Convert to quote/booking" from the calculator requires login.

## 2. Why Noatum needs it

- **Regulation** — large shippers must report transport emissions (EU CSRD, ESG disclosures). A forwarder that gives them the number per shipment is easier to buy from.
- **Sales** — the public tool is a lead magnet with a "convert to quote" button.
- **Mode shift** — showing air vs sea CO2 nudges customers to sea, which is usually also cheaper.

## 3. The formula (simple)

```
CO2 (kg) = weight of goods (tonnes) × distance travelled (km) × emission factor
```

- **Weight** — the customer gives it (or it comes from the booking / shipment record).
- **Distance** — how far the ship / plane / truck actually travels. See §5 — this is the hard part.
- **Emission factor** — a published number saying how many grams of CO2 one tonne of cargo causes per km on a given type of transport. Air is roughly 40–60 times higher than sea per tonne-km.

Shipments with several legs (truck → ship → truck) are calculated leg by leg and added up.

## 4. Vocabulary — avoid confusion with the Pricing module

| Word | Meaning here | Do NOT confuse with |
|---|---|---|
| **Emission factor** | Fixed published number (g CO2 per tonne-km) per transport type | "Rate" in the Pricing / Rate Management module, which means money |
| **kg CO2e** | Kilograms of CO2 *equivalent* — all greenhouse gases converted to a CO2 figure | Plain CO2 |
| **GLEC Framework** | The global rulebook for calculating freight emissions, published by Smart Freight Centre | — |
| **ISO 14083** | The official international standard version of GLEC (2023) | — |
| **Well-to-wheel (WTW)** | Includes emissions from producing the fuel, not just burning it. Standard reporting basis | Tank-to-wheel (burning only) |
| **Tonne-km** | 1 tonne moved 1 km. The unit of "transport work" | — |

## 5. Where the data comes from

| Data | Source | Notes |
|---|---|---|
| Emission factors | GLEC Framework (Smart Freight Centre), DEFRA (UK), EPA (US), ADEME (FR) — all public documents | Small table (~100–300 rows). Changes about once a year. |
| Airport / port coordinates | UN/LOCODE + IATA tables — already coming from CW1 master data (PRD §5 "UNLOCO") | Cached, refreshed daily |
| Air distance | Great-circle (straight-line) formula between airports, +5% as GLEC allows | We compute it ourselves |
| Sea distance | Must follow real shipping lanes (around Singapore, via Suez, etc.) — straight line is badly wrong (Shanghai–Rotterdam ≈ 19,000 km real vs ≈ 9,000 km straight) | Open-source `searoute` library to start; Searoutes (paid) for accuracy |
| Road distance (door pickup / delivery) | Routing API — Azure Maps fits our stack | Cache per address pair |
| Vessel / aircraft type (for Final figures) | CW1 TransportLeg (vessel name / IMO, flight number) + carrier event feed | Already in ingestion |

## 6. Public APIs that exist (as at 03.09.2026 — re-verify before choosing)

| Provider | What it does | Cost |
|---|---|---|
| **Climatiq** | Freight endpoint following GLEC v3 / ISO 14083; send legs, get CO2 back; includes hub/port handling emissions | Paid, free trial tier |
| **Searoutes** | Sea-focused; vessel-specific CO2, GLEC-accredited, ISO 14083; also gives realistic sea distances | Paid |
| **EcoTransIT World** | Long-standing all-modes tool, GLEC-recognised | Paid |
| **FreightUtils** | Free REST API, no signup; returns CO2 for a leg and states the factor used; **does not** calculate distance | Free |

## 7. Decision: build vs buy — agreed direction

**Approach: store factors in our own DB and calculate ourselves; keep a provider slot for later.**

Why this is good:
- Factor table is tiny and changes yearly — no reason to call an API for it.
- Fast, works offline from third parties, zero cost per request.
- Easy to explain to a customer exactly which factor row was used.

Three rules that make it safe:
1. **Take factors from the original public sources** (GLEC / DEFRA / EPA), not by copying them out of somebody's free API. Record source + version on every row.
2. **Distance is the real work, not the factor.** Use our own air formula, `searoute` for sea, Azure Maps for road.
3. **Label all results "Estimate"** with a short disclaimer ("Estimated using GLEC v3 default factors"). This is fine for the calculator, booking and tracking screens. It is **not** enough for a customer's officially audited carbon report — for that, plug in a certified provider (Climatiq / Searoutes / EcoTransIT) later. This is what OQ-11 must decide.

## 8. Implementation design

### 8.1 Service contract

```
EmissionsService.estimate(legs[], cargo) →
  {
    kgCo2e,            // total, well-to-wheel
    band,              // low | medium | high (for grid filter)
    status,            // predicted | final
    methodology,       // "GLEC v3.x / ISO 14083"
    factorVersion,     // e.g. "GLEC-2024-12"
    legs: [ { mode, from, to, distanceKm, distanceSource, factorId, kgCo2e } ]
  }
```

All three screens call this one service. Provider sits behind an `EmissionsAdapter` interface — same pattern as `TmsTrackingAdapter` etc. Day one = `LocalGlecAdapter`; later = `ClimatiqAdapter` with no screen changes.

### 8.2 Tables

**EmissionFactor** — never delete rows; add new versions so old shipments keep the number they were calculated with.

| Column | Example |
|---|---|
| factor_id | `SEA-CONTAINER-DEEPSEA-WTW` |
| mode | SEA / AIR / ROAD / RAIL |
| sub_mode | Container ship deep-sea, Freighter aircraft, Belly-hold wide-body, Artic 40t diesel |
| g_co2e_per_tonne_km | 10.5 |
| scope | WTW |
| source | GLEC Framework v3.1 |
| source_version | 2024 |
| valid_from / valid_to | 01.01.2025 / — |

**EmissionRecord** (already in PRD canonical model, §6) — extend with: `factor_version`, `distance_source`, `leg_breakdown` (JSON), `override_kg`, `override_reason`, `override_by`, `override_at`.

### 8.3 Runtime behaviour

- **Public calculator** — synchronous; cache by (origin, destination, mode, weight bucket); rate-limit and bot-protect (public endpoint).
- **Booking** — call when route + cargo are complete; store on Booking; show disclaimer.
- **T&T** — background worker recalculates on each TransportLeg change (predicted) and once at shipment close using actual legs (final). Grid and filter read from `EmissionRecord`, never from the engine live.

### 8.4 Human-in-the-loop (platform principle)

Every CO2 figure carries provenance (factor row, distance, distance source). Ops can override a final figure with a mandatory reason; the original value is kept. Same rule as everywhere else on the platform: AI/automated output is never read-only.

## 9. Open items

| # | Item | Owner |
|---|---|---|
| OQ-11 | Certified methodology / provider and legal disclaimer text | Sustainability + Legal |
| — | Which GLEC version and which sub-mode defaults to use when vessel / aircraft type is unknown | Product + Ops |
| — | Emission band thresholds (low / medium / high) | Product |
| — | Licence check on `searoute` library and GLEC factor reuse terms | IT / Legal |

## 10. Sources consulted

- Climatiq Freight v3 / ISO 14083 documentation — climatiq.io/docs
- Searoutes GLEC Framework 2025 guide — searoutes.com
- FreightUtils Freight Emissions Calculator — freightutils.com/emissions
- Smart Freight Centre — GLEC Framework (primary factor source)
