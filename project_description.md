# Poseidon — AI for Coastal Flood Intelligence

> **Know before the water arrives.**
> Singularity 2026 · Track 1 · 24-hour working prototype · runs fully on a laptop

---

## 1. The story Poseidon is built around

A coastal neighbourhood, a rainy afternoon. The rain is heavy, the tide is climbing, and the drains are already struggling. A family on the ground floor is asking:

> *Will the water reach our street? When? Should we leave now, or can we wait until evening?*

Today's warning says "flood risk: high", which is too broad to act on. Poseidon answers the questions people actually ask:

| The question | Poseidon's answer |
|---|---|
| **Where** will water reach? | Neighbourhood hexagons and individual streets, hour by hour |
| **When**? | Onset and peak as *time windows*, e.g. onset 2:40 PM (2:10–3:20), peak 4:10 PM |
| **How bad**? | Predicted depth class, plus whether the *ground floor* is affected |
| **Should we leave now or wait?** | A household advisor: *Leave by 3:00 PM*, *Safe to wait, re-check at 5 PM*, or *Route cut, move upstairs* |
| **Who needs help first**? | A ranked responder list with a visible score breakdown, and the roads to use |
| **Why**? | Plain-language drivers: *"high tide is blocking the drains just as the rain peaks"* |
| **How sure**? | Calibrated probability, time windows, and rank stability across forecasts |

**Why this is hard, in one line:** the floods in this story are *compound*. Heavy rain, a rising tide and overloaded drains interact: a high tide stops drains emptying, so the same rain floods a street at high tide but not at low tide. Poseidon models that interaction explicitly.

---

## 2. Walkthrough (the demo is this story, in seven steps)

Build the product so this exact sequence runs from cache, with no internet.

1. **The afternoon begins.** The dashboard shows the incoming forecast: a rain ensemble, the tide curve, any surge. A banner reads *"Heavy rain peaks 3:00 PM. High tide 2:10 PM."* This overlap is the hook.
2. **The map lights up.** Hexagons are coloured by flood probability. A time slider and play button show water spreading hour by hour.
3. **Zone alert, in the brief's format**, plus uncertainty:
   > **HIGH FLOOD RISK — Zone B** · Probability 82% · Peak depth 0.45 m (0.30–0.70 m)
   > **Onset 2:40 PM** (2:10–3:20 PM) · **Peak 4:10 PM**
   > **Drivers:** high tide blocking drains when rain peaks (38%), 85 mm rain in 3 h (29%), low ground 0.8 m above sea level (21%)
4. **What is in the way.** Affected roads (impassable from when), buildings, and critical facilities (hospital, shelters, fire station), each marked *dry / access cut / flooded*.
5. **"Will it reach our street?"** Click a street or type its name. The street panel shows the street's own onset, peak and depth, and whether a ground-floor home (default 30 cm plinth, editable) is affected.
6. **"Should we leave now or wait?"** The household advisor gives a verdict and compares the two choices:
   > **Your street: Temple Road, Zone B** *(illustrative numbers)*
   > Water on the street from **2:40 PM**; ground floor likely flooded from about **3:15 PM**.
   > Your route to Shelter X (1.2 km) stays passable until about **3:25 PM**.
   > **LEAVE BY 3:00 PM.** If you miss that, move to an upper floor; do not walk through the water.
   > *If you wait until evening:* the road is still closed at 6 PM, and depth is still around 30 cm.
7. **Who needs help first, and what-if.** The responder priority list shows each zone's score breakdown and rank stability ("Zone B is top-3 in 87% of forecasts"). Drag the tide slider down 0.5 m and watch Zone B fall from 82% to 41% (use your real model output, not these sample numbers). One click produces a grounded incident briefing.

---

## 3. System pipeline

```
 ┌────────────── ONE-TIME PREP (cached) ───────────────┐
 │ DEM · OSM roads/buildings/facilities · land cover   │
 │        ↓                                            │
 │ Terrain features per zone and street:               │
 │ elevation, slope, sink depth, HAND, dist-to-coast,  │
 │ imperviousness (curve number), drainage proxy       │
 └──────────────────────┬──────────────────────────────┘
                        ↓
 ┌────────── 1. SCENARIO ENGINE (Poseidon-Sim) ────────┐
 │ 800–1,500 synthetic events:                         │
 │ storm shape × tide phase/amplitude × surge × wetness│
 │ Reduced-physics → depth time series per cell        │
 │ Labels per zone: P(flood), peak depth, peak time,   │
 │ onset at 10 cm (water on street), onset at 30 cm    │
 │ (road impassable / ground floor at risk)            │
 └──────────────────────┬──────────────────────────────┘
                        ↓
 ┌────────── 2. SURROGATE MODELS (LightGBM) ───────────┐
 │ Features: terrain + forecast + tide–rain overlap    │
 │ Heads: flood prob · peak depth · onset@10 cm ·      │
 │        onset@30 cm · peak time                      │
 │ Forecast-error augmentation → calibration           │
 └──────────────────────┬──────────────────────────────┘
                        ↓
 ┌────────── 3. LIVE / REPLAY FORECAST ────────────────┐
 │ Rain ensemble + tide/marine data (or cache)         │
 │ Model per member → probability, windows,            │
 │ depth interval, rank stability                      │
 └──────────────────────┬──────────────────────────────┘
                        ↓
 ┌────────── 4. IMPACT & ACCESS ───────────────────────┐
 │ Depth → road closure times → building exposure      │
 │ → facility status                                   │
 │ → TIME-TO-SAFETY FIELD: for every node and every    │
 │   30-min departure step, travel time to the nearest │
 │   reachable shelter/hospital on the flooded graph   │
 └──────────────────────┬──────────────────────────────┘
                        ↓
 ┌────────── 5. EXPLAIN ───────────────────────────────┐
 │ SHAP drivers → everyday phrases                     │
 │ Counterfactuals ("if the tide were 0.5 m lower…")   │
 └──────────────────────┬──────────────────────────────┘
                        ↓
 ┌────────── 6. DECIDE ────────────────────────────────┐
 │ Household advisor (leave now / by hh:mm / wait)     │
 │ Responder Priority Index · alert tiers · routes     │
 │ Grounded briefing                                   │
 └──────────────────────┬──────────────────────────────┘
                        ↓
              Streamlit + pydeck dashboard
```

### Stage details

**Prep.** One study area, at most 10×10 km. I used Mangaluru as the default example because it is a low-lying coastal city with both monsoon rain and tides, and local knowledge helps when you sanity-check hotspots. Everything is config-driven (`city.yaml`), so changing the bounding box changes the city. Zones are H3 resolution-9 hexagons (~0.1 km²), labelled with the nearest OSM place name so alerts say "Zone B (Bolar)", not a hex ID. Street names come from the OSM road graph, so street search works offline. Place and street names in the sample alerts are illustrative.

**1. Poseidon-Sim.** A fast reduced-complexity simulator, *not* a calibrated hydrodynamic model. Per timestep and per 30 m cell:
- Rain becomes runoff via the SCS curve-number method (land cover and antecedent rain).
- Drainage capacity is **reduced by a tide-blocking factor**: `capacity × (1 − sigmoid((tide − outfall_level)/s))` for cells draining toward the coast or creeks. This is the "drains already struggling as the tide climbs" part of the story, made explicit.
- Excess water ponds, then moves downslope in a few cheap redistribution passes, capped by sink depth.
- Coastal flooding: still-water level = tide + surge. A cell floods only if it is below that level **and connected to the sea** (connected-component labelling), so isolated inland pockets are not wrongly flooded.
- Depth = the larger of ponded and coastal depth. Per zone, record max depth, hour of max, and the first hour above 10 cm and above 30 cm.

Scenario sampling: Huff-type storm shapes (5–200 mm/24 h), tide from harmonic constituents with random phase and spring/neap amplitude, surge 0–1.2 m, antecedent wetness. Add a few hand-built replay storms for the demo.

**2. Surrogate models.** LightGBM, one row per zone per event:
- `P(flood)`: classifier, depth ≥ 10 cm (configurable).
- `peak depth`: regressor with 10/50/90% quantile heads.
- `onset@10 cm`, `onset@30 cm`, `peak time`: regressors on flooded rows, gated by `P(flood)`.

Key features: rain totals (1/3/6/24 h), peak intensity and its time, high-tide time and height, surge, **tide–rain overlap index** (rain within ±2 h of high tide), 72 h antecedent rain, and static terrain/drainage features.

*Forecast-error augmentation:* train on perturbed inputs (rain magnitude/timing, tide/surge timing) against clean simulator truth, so the model stays sensible under imperfect forecasts.
*Calibration:* isotonic regression for probabilities; split-conformal adjustment so the stated 80% depth interval covers about 80% on held-out events.

**3. Forecast stage.** Load ensemble rain and marine data (live or cached), run each member through the models, and report calibrated probability, onset and peak windows (P10–P90), depth interval and rank stability.

**4. Impact and access.**
- A road segment closes at its zone's `onset@30 cm` (with a partial-failure speed reduction for shallower water, not just open/closed).
- Buildings and facilities are intersected with predicted depth; the ground floor is affected when depth exceeds the plinth height.
- **Time-to-safety field:** for each 30-minute departure step, run a multi-source Dijkstra from shelters and hospitals on the reversed graph, where an edge is usable only if it stays open for the whole trip window. I plan on the **early end of the closure window (P10)**, so advice errs on the safe side. Cost: my benchmark ran 12 steps in about 13 s, so 48 steps is roughly a minute per forecast refresh. The household lookup is then instant.
- Zones whose access time jumps or becomes infinite are flagged as **flood-induced medical deserts**.

**5. Explain.** SHAP values for the classifier on each flagged zone; the top three drivers become phrases from a template library. Counterfactuals re-run the model with edited inputs (tide −0.5 m, rain peak 3 h earlier) and report the change.

**6. Decide.**

*Household advisor.* Inputs: location (click or street name), floor (ground or upper), plinth height (default 30 cm), "someone needs assistance" toggle (adds a larger time buffer). Logic:
```
t_ground  = time depth reaches plinth height   (interpolated from onset@10, onset@30, peak)
t_cut     = latest departure from the time-to-safety field (P10 closure), minus buffer
LEAVE NOW / LEAVE BY hh:mm : ground floor will flood AND a safe route exists until t_cut
SAFE TO WAIT (re-check at …): P(ground floor flooded) low through the evening window
ROUTE CUT, MOVE UPSTAIRS     : no safe departure left, or the family is already past t_cut
```
It always shows the "wait until evening" comparison: depth and route status at 6 PM. This is decision support, not an official evacuation order, and the app must say so on screen.

*Response Priority Index* per zone:
```
RPI = 100 × H × ( a·Exposure + b·Vulnerability + c·AccessLoss + d·Urgency )
H       = P(flood) × severity score (depth class → 0–1)
Urgency = exp(−lead_time / 3 h)           # sooner onset → higher urgency
defaults: a=0.3, b=0.2, c=0.3, d=0.2      # adjustable in the dashboard
```
Each row shows its component breakdown, so the ranking is defensible. The grounded briefing is generated from a facts-JSON, and numbers in the output are checked against it, with a template fallback on any mismatch.

---

## 4. Research gaps Poseidon targets

From a search of recent literature (2025–2026 where available). **Read the papers yourself before quoting them on a slide.**

| # | Gap | Evidence | What Poseidon does |
|---|---|---|---|
| G1 | **Drivers are often assessed separately**, though compound floods come from their interaction | Atmaja et al., PI-GeoAI surrogate for compound flood risk, J. Environ. Manage. 2026; review of compound flooding in coastal cities (2026) | Explicit tide–drain blocking and a tide–rain overlap feature |
| G2 | **Surrogates mostly predict maximum depth or extent, not when water arrives** (in the papers I found) | HyFlood (Coastal Engineering, 2026) validates daily maxima; the Macao LSTM–CNN hybrid and LightGBM–CNN (Haidian Island) predict spatial max depth | Separate onset@10 cm, onset@30 cm and peak-time heads, scored with time-error metrics |
| G3 | **Poorly calibrated uncertainty; extremes handled badly** | *Open problems in uncertainty quantification for flood modelling*, Env. Modelling & Software | Ensemble windows, conformal intervals, reliability diagram, extreme-storm stress test |
| G4 | **Warnings are prediction-centric; the weak links are uncertainty communication and decision support** | Tran et al., FEWS-DM, Earth's Future 2026 | Alerts with windows, and a household advisor that ends in a decision with a leave-by time |
| G5 | **Explainability stays expert-level** (I did not find responder- or household-facing translation) | LSTM–attention + SHAP compound-flood study (2025) | SHAP → everyday phrases, plus counterfactual what-if |
| G6 | **Access and equity studies use fixed return-period scenarios, not live forecasts** | Medical-deserts preprint (EGUsphere, July 2026); Guangzhou shelter-accessibility study (2026); Delaware critical-facility study (Gangwal et al.) | Forecast-driven, time-stepped access loss feeding both the household advisor and the responder ranking |
| G7 | **Two-stage surrogates propagate error; validation can leak across space or time** | Deep vision-based coastal flood framework (Sci. Reports) notes error propagation in two-step surrogates | Single-stage models; validation split by event and by spatial block |

The household "leave by" time is my own synthesis of G4 and G6, not something I found published as a finished method. Treat it as the project's main original contribution and be ready to explain its assumptions. I did not find a paper combining all of these in one live tool, but I only searched briefly. Say "we combine…", not "first ever."

---

## 5. USP (20 seconds)

> **"Poseidon doesn't say 'flood risk: high.' It tells a family on the ground floor *when the water reaches their street, whether to leave now, and by when* — and tells responders *who to reach first, by which road* — and shows *why* and *how sure we are*."**

1. **From forecast to household decision.** Street-level onset plus a "leave by" time that accounts for the route closing, and a "wait until evening" comparison.
2. **Compound-timing intelligence.** Tide-blocked drainage modelled explicitly, with counterfactuals such as *"if the rain peaked 3 hours earlier, before high tide, depth would drop by X cm."*
3. **Honest uncertainty.** Onset and peak are windows, probabilities are calibrated, advice plans on the early end of the window, and rankings show stability.
4. **Forecast-driven access loss.** Which neighbourhoods lose their route to a hospital or shelter, and when.
5. **Grounded bilingual communication.** English and Kannada messages from verified templates, so wording cannot drift from the numbers.
6. **Honest validation.** Event-held-out and spatial-block splits, baselines, reliability diagram, extrapolation stress test.

---

## 6. MVP structure

| Tier | Contents | Done when |
|---|---|---|
| **P0: MVP (must demo)** | Data prep → Poseidon-Sim → LightGBM heads → zone predictions → map with time slider → zone alert with drivers → **street check with ground-floor exposure** → impact panel → priority list → one replayable storyline | Steps 1–5 of the walkthrough run from cache offline |
| **P1a: the story's payoff** | Ensemble windows + calibration → **time-to-safety field → household leave-now advisor** → what-if panel | Step 6 works: a street gets a verdict and a leave-by time |
| **P1b: extras** | Forecast-error augmentation, rank stability, timing counterfactual | Priority list shows stability |
| **P2: polish** | Grounded briefing (Ollama + template fallback), Kannada templates, dispatch routing, live-data toggle | Bonus only |
| **P3: roadmap slide** | Sentinel-1 validation, gauge calibration, municipal drain maps, SMS/WhatsApp dissemination | Mentioned, not built |

**Scope is the risk.** P0 plus P1a is roughly 25 hours of work at my estimates. See `features.md` for the cut rules and how to split it if you are not working alone.

---

## 7. Validation plan (25% of the score)

**Say this upfront:** training labels come from Poseidon-Sim, not observed flood depths. The brief allows simulated data. Frame results as *surrogate fidelity and robustness* and add a reality check.

| Check | How | Report |
|---|---|---|
| Event-held-out | Split by scenario ID, never by row | ROC-AUC, PR-AUC, Brier, F1 at alert threshold |
| Spatial-block | Hold out whole blocks of zones | Same metrics |
| Timing | Flooded cases only | MAE (hours) of onset@10, onset@30, peak time |
| Depth | Held-out events | MAE, empirical coverage of the 80% interval |
| Calibration | Reliability diagram | Predicted vs observed frequency |
| Baselines | (a) elevation-only susceptibility, (b) rain-only logistic regression | Gain from tide, timing and drainage features |
| Extrapolation | Train on moderate events, test on the top storms | Where it degrades, and that it flags low confidence |
| Advisor safety check | On held-out events, how often does "safe to wait" precede a real ground-floor flood, and how often does "leave by" come after the true route closure? | Report both error rates. This is the one that matters most for a household decision. |
| Plausibility | Do hotspots match places reported waterlogged? | Hotspot recall on a handful of known spots, labelled qualitative |

---

## 8. Mapping to the judging rubric

| Criterion (weight) | Where Poseidon earns it |
|---|---|
| Prediction quality (25) | Five calibrated heads incl. onset and peak, event/spatial validation, baselines, stress test, advisor error rates |
| Local geospatial depth (20) | 30 m terrain, hex zones, street-level lookup, connectivity-aware coastal flooding, road/building/facility mapping, time-to-safety field |
| Explainability (15) | SHAP → everyday phrases, counterfactual what-if |
| Actionability (15) | Timed alerts, **leave-by advice**, priority index with breakdown, flood-aware routes |
| Dashboard & usability (10) | Map, timeline, alert and street panel as one story |
| Innovation (10) | Ensemble windows, tide-blocked drainage, household advisor, access loss, grounded bilingual briefing |
| Demo & storytelling (5) | The family's afternoon, scripted, with a backup video |

---

## 9. Known limitations (say them before the judges do)

- Labels are simulated. Reported accuracy is fidelity to Poseidon-Sim plus robustness checks, not real-world accuracy.
- The DEM is a surface model and misses fine drainage detail. Drainage capacity is a proxy from land use and road density, since real drain maps are rarely open.
- Zone-level predictions are applied to streets, so street-level depth is an estimate. Say "street-level estimate", not "exact".
- Plinth height is an assumption (editable), not surveyed per building.
- Road closure uses a depth threshold, not vehicle-specific physics.
- The household advice is decision support for a prototype. It does not replace official warnings or evacuation orders, and the app must say so.
