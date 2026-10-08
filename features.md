# Poseidon — Features

> Built around the Track 1 story: a rainy afternoon, a rising tide, struggling drains, and a family on the ground floor asking *"Will the water reach our street? When? Should we leave now, or wait until evening?"*
> Priority key: **P0** must work for the demo · **P1a** the story's payoff · **P1b** extras · **P2** polish, cut first · **P3** roadmap slide only.
> Effort = rough hours for one person at hackathon pace.

---

## 1. Brief's questions → features

| The brief asks | Feature(s) |
|---|---|
| **Where** | F8 map, F11 street check |
| **When** (onset, peak) | F3 heads, F7 windows, F9 timing strip, F15 alert card |
| **How bad** (probability, severity) | F3, F12 ground-floor exposure |
| **Leave now or wait until evening?** | F13 time-to-safety field, F14 household advisor |
| **Who needs help first** | F17 priority index, F18 rank stability, F23 routes |
| **Why** | F16 plain drivers, F20 counterfactual |

## 2. Deliverables checklist (from the brief)

| Required deliverable | Covered by | Tier |
|---|---|---|
| Flood model: probability, severity, onset, peak | F2–F4 | P0 |
| Interactive dashboard, live-updating risk map | F8, F9 | P0 |
| Zone-level alerts in the brief's format | F15 | P0 |
| Affected roads, buildings, critical facilities per zone | F10 | P0 |
| Ranked priority list for emergency response | F17 | P0 |
| Plain-language explanation of every prediction | F16 | P0 |

---

## 3. Feature list

### A. Data and modelling core

| ID | Feature | What it does | Tier | Hours |
|---|---|---|---|---|
| F1 | **Terrain and zone builder** | DEM + OSM → H3 zones; elevation, slope, sink depth, distance to coast/creek, imperviousness, drainage proxy; street-name index from the road graph | P0 | 2 |
| F2 | **Poseidon-Sim scenario engine** | Curve-number runoff, **tide-blocked drainage**, connectivity-aware coastal flooding. 800–1,500 events. Labels per zone: P(flood), peak depth, peak time, onset at 10 cm and at 30 cm | P0 | 2.5 |
| F3 | **Five-head surrogate model** | LightGBM: flood probability, peak depth (quantiles), onset@10 cm (water on street), onset@30 cm (road impassable / ground floor at risk), peak time | P0 | 2 |
| F4 | **Validation suite** | Event-held-out and spatial-block splits, baselines, timing and depth errors, reliability diagram | P0 | 1.5 |
| F5 | **Forecast-error augmentation** | Train on perturbed rain/tide inputs against clean truth | P1b | 0.5 |
| F6 | **Calibration + conformal intervals** | Isotonic probabilities; split-conformal depth intervals (~80% coverage) | P1a | 1 |
| F7 | **Ensemble forecast engine** | Model on each rain-ensemble member → probability, onset/peak windows (P10–P90) | P1a | 1.5 |

### B. Map and impact

| ID | Feature | What it does | Tier | Hours |
|---|---|---|---|---|
| F8 | **Live flood-risk map** | pydeck H3 layer coloured by probability or depth; time slider and play button; roads and facility icons | P0 | 2 |
| F9 | **Compound-timing strip** | Rain curve and tide curve on one chart, with the overlap window highlighted | P0 | 0.5 |
| F10 | **Impact panel** | Per zone: roads (impassable from hour X), buildings affected, facilities *dry / access cut / flooded* | P0 | 1.5 |

### C. Household layer (the story's payoff)

| ID | Feature | What it does | Tier | Hours |
|---|---|---|---|---|
| F11 | **Street check** | Click the map or type a street name → that street's onset, peak, depth class and probability | P0 | 1.5 |
| F12 | **Ground-floor exposure** | Plinth height (default 30 cm, editable) and floor toggle → "ground floor likely flooded from ~3:15 PM" | P0 | 0.5 |
| F13 | **Time-to-safety field** | For every road node and each 30-minute departure step: travel time to the nearest reachable shelter/hospital on the flooded graph, planning on P10 (early) closure times. Also yields the medical-desert flag | P1a | 2 |
| F14 | **Household leave-now advisor** | Verdict: **Leave now / Leave by hh:mm / Safe to wait, re-check at hh:mm / Route cut, move upstairs**. Always shows the "wait until evening" comparison. "Needs assistance" toggle widens the buffer. Carries an on-screen "decision support, not an official order" notice | P1a | 2 |

### D. Explanation and decision

| ID | Feature | What it does | Tier | Hours |
|---|---|---|---|---|
| F15 | **Zone alert card** | *"HIGH FLOOD RISK, Zone B. Onset 2:40 PM, peak 4:10 PM. Drivers: …"* with windows | P0 | 1 |
| F16 | **Plain-language drivers** | SHAP top-3 → everyday phrases with values and percentages | P0 | 1 |
| F17 | **Response Priority Index** | Hazard × (exposure, vulnerability, access loss, urgency). Weight sliders, per-row breakdown | P0 | 1 |
| F18 | **Rank stability** | "Zone B is top-3 in 87% of ensemble members" | P1b | 0.5 |
| F19 | **What-if panel** | Sliders for tide offset, rain multiplier, rain-peak shift. Re-runs the model in <1 s, updates the map and the household verdict | P1a | 1.5 |
| F20 | **Timing counterfactual** | Auto-text: *"If rain peaked 3 h earlier, depth would drop by X cm"* | P1b | 0.5 |

### E. Communication and extras

| ID | Feature | What it does | Tier | Hours |
|---|---|---|---|---|
| F21 | **Grounded incident briefing** | Local LLM paraphrases a facts-JSON; numbers verified against it, template fallback on mismatch | P2 | 1.5 |
| F22 | **Kannada + English household messages** | Template-based, not LLM-generated, so numbers cannot drift. Have a native speaker proofread | P2 | 1 |
| F23 | **Flood-aware dispatch routes** | Assigns N teams to top-ranked zones using flooded-graph travel times | P2 | 1.5 |
| F24 | **Live-data toggle** | Cached replay ↔ live API calls, graceful fallback | P2 | 1 |
| F25 | **Export** | Alerts and priority list as CSV/PDF | P2 | 0.5 |

### F. Roadmap only (slide, no code)

F26 Sentinel-1 flood-extent validation · F27 real gauge/tide-station calibration · F28 municipal drain maps · F29 SMS/WhatsApp dissemination · F30 new city by editing `city.yaml`

---

## 4. Alert and advisor logic

**Severity classes (peak depth, configurable):**

| Class | Depth | Plain meaning |
|---|---|---|
| None | < 10 cm | No significant water |
| Minor | 10–30 cm | Ankle to calf. Slow traffic |
| Moderate | 30–60 cm | Small cars stall. Ground-floor entry possible |
| Severe | 60–100 cm | Roads impassable. Ground floors flooded |
| Extreme | > 100 cm | Life-threatening. Evacuate |

**Zone alert tier (probability × severity):**

| | Minor | Moderate | Severe / Extreme |
|---|---|---|---|
| P < 30% | Watch | Watch | Advisory |
| 30–60% | Advisory | Advisory | Warning |
| P > 60% | Advisory | Warning | **Emergency** |

**Household verdict (F14):**

| Verdict | When |
|---|---|
| **Leave now / Leave by hh:mm** | Ground floor likely floods **and** a safe route stays open until the leave-by time |
| **Safe to wait, re-check at hh:mm** | Low chance the ground floor floods through the evening window |
| **Route cut, move upstairs** | No safe departure remains. Never advise walking or driving through floodwater |

Thresholds are starting points. State in the demo that they are configurable and not an official standard.

---

## 5. Build plan: be realistic about scope

My hour estimates add up to about **25 hours for P0 + P1a**. You have 24 hours total, and rehearsal, setup and bug-fixing take about 4–5 of them. Solo, that does not fit. So:

**If you are working alone:** build all of P0, then **F7 → F14 (with F13) → F6**, in that order. Skip F19 unless you finish early. In the demo, show the household verdict from the replay storyline and say the what-if is on the roadmap.

**If you have 2–3 people** (check the team-size rules), split like this:

| Person | Owns |
|---|---|
| A: Data and model | F1, F2, F3, F4, F5, F6, F7 |
| B: Geospatial and decisions | F10, F11, F12, F13, F14, F17, F18 |
| C: Dashboard and story | F8, F9, F15, F16, F19, demo script, backup video |

Agree on one interface early: a `zone_predictions.parquet` (one row per zone per ensemble member) and an `edge_closure.parquet` (one row per road segment). Then B and C can work from fake data from hour 3.

### Timeline (solo order; compress if you are a team)

| Hours | Work | Gate before moving on |
|---|---|---|
| **0–1** | Repo, venv, `city.yaml`. **Start data downloads immediately**, then code while they run | Every package imports |
| **1–3** | F1 | Zones and elevation render on a map |
| **3–5.5** | F2 | One scenario gives a believable depth map: low areas wet, hills dry, tide-blocking visible |
| **5.5–9** | F3, F4 | Beats both baselines on held-out events |
| **9–12** | F8, F9, F15 | Click a zone, see an alert |
| **12–15** | F16, F17, F10 | Priority list and impact panel work |
| **15–17** | F11, F12 | Pick a street, see onset and ground-floor status |
| **17–19** | F7 (and F6 if time) | Alerts show windows |
| **19–22** | F13, F14 | A street gets a verdict and a leave-by time |
| **22–23.5** | Freeze code. Rehearse twice. Record backup video. Pin requirements. README | Full run-through within your time limit |
| **23.5–24** | Buffer | |

### Cut rules
- **Behind at hour 9:** drop F5 and everything in P2.
- **Behind at hour 15:** drop F6, F18, F20. Keep F7 only if the windows are working.
- **Behind at hour 19:** keep F13 and F14 in a simplified form: compute the time-to-safety field at only 4 departure times (now, +1 h, +2 h, +3 h) instead of every 30 minutes.
- **Never cut:** F4 validation (25 points) and the advisor safety check in `project_description.md` §7. A wrong "safe to wait" is the worst error this system can make, so measure it.
- **Ahead of schedule:** add F22 (Kannada) before F21 (LLM). It is cheaper and more reliable.

### Before the hackathon starts
Ask the organisers whether pre-downloading open datasets and installing packages is allowed. Writing project code before kickoff almost certainly is not. Do not risk disqualification for a few hours' head start.

---

## 6. Demo script (≈ 4–5 minutes, adjust to your slot)

| Time | Show | Say |
|---|---|---|
| 0:00 | Story slide | "A rainy afternoon. The tide is climbing. A family on the ground floor wants to know: do we leave now or wait?" |
| 0:30 | Forecast banner and timing strip | "High tide at 2:10, rain peaks at 3:00. That overlap is what overwhelms the drains." |
| 1:00 | Map with time slider | "Neighbourhood level, hour by hour." |
| 1:45 | Click Zone B → alert card | "Where, when, how bad, how sure, and why." |
| 2:30 | Street check → household advisor | "Their street is wet from 2:40, the route is cut at 3:25. Leave by 3:00. If they wait until evening, the road is still closed." |
| 3:15 | Priority list and rank stability | "For responders: who first, and the ranking holds in 87% of forecasts." |
| 3:45 | What-if slider (if built) | "Half a metre less tide and Zone B drops from 82% to 41%." |
| 4:15 | Validation slide | "Held-out events, baselines, calibration, and where it breaks." |
| 4:45 | Close | "Know before the water arrives." |

**Use your real model outputs.** The 82%, 41%, 87% and clock times here are placeholders, never results.

---

## 7. Scope traps

- **Perfecting the simulator.** Stop at "believable." The judged work is the model, map, explanation and action layers.
- **Deep learning.** It costs setup time, hurts explainability, and gains little here.
- **Live APIs as the only data path.** Cache first, live second.
- **Pretty UI before correct numbers.** Get outputs right by hour 12, polish after.
- **Overclaiming the advisor.** It is a prototype's decision support. Never say it replaces official warnings, and never present placeholder numbers as results.
