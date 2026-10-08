# Poseidon — Coastal Flood Intelligence System

## Project Overview

Poseidon is an AI system for coastal flood intelligence that predicts when floodwater will reach specific streets and provides actionable household decision support. It models compound flooding (heavy rain + rising tide + blocked drains) explicitly.

## Core Problem

During heavy rain with rising tide, drains struggle to empty water. The same rainfall that doesn't flood at low tide will flood at high tide. Poseidon models this interaction and answers what people actually ask:

- **Where** will water reach? (Neighborhood hexagons, street level)
- **When**? (Onset and peak as time windows)
- **How bad**? (Predicted depth class, ground floor impact)
- **Should we leave now or wait?** (Household advisor with leave-by times)
- **Who needs help first**? (Responder priority list)
- **Why**? (Plain-language drivers)
- **How sure**? (Calibrated probability and rank stability)

## Technology Stack

Python-based stack using:
- **NumPy/Pandas** for data processing
- **LightGBM** for surrogate models
- **Streamlit** for web interface
- **pydeck** for interactive maps
- **H3** for hexagonal zoning
- **OSM** for street/building data

## Architecture

```
┌────────────── ONE-TIME PREP (cached) ───────────────┐
│ DEM · OSM roads/buildings/facilities · land cover   │
│        ↓                                            │
│ Terrain features per zone: elevation, slope, etc. │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌────────── 1. Poseidon-Sim (reduced-physics) ────────┐
│ 800-1,500 synthetic events with tide-blocking       │
│ Reduced-physics → depth time series per cell       │
│ Labels: P(flood), peak depth, onset@10cm/30cm       │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌────────── 2. Surrogate Models (LightGBM) ───────────┐
│ 5-heads: flood prob · peak depth · onsets · time    │
│ Features: terrain + forecast + tide–rain overlap   │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌────────── 3. Live/Replay Forecast ──────────────────┐
│ Rain ensemble + marine data → model per member     │
│ Calibrated probability, windows, depth interval    │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌────────── 4. Impact & Access ───────────────────────┐
│ Depth → road closure → building exposure            │
│ Time-to-safety field → household advisor          │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌────────── 5. Explain ───────────────────────────────┐
│ SHAP values → everyday phrases                      │
│ Counterfactual what-if                              │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌────────── 6. Decide ────────────────────────────────┐
│ Household advisor: Leave now / by / wait           │
│ Responder priority index with breakdown            │
└──────────────────────┬──────────────────────────────┘
                       ↓
                Streamlit + pydeck dashboard
```

## Key Features (P0+P1a)

### Data and Modelling Core
- **F1-F4**: Terrain processing, flood simulation, surrogate models, validation
- **F5-F7**: Forecast-error augmentation, calibration, ensemble forecasts

### Map and Impact
- **F8-F10**: Live flood-risk map, timing strip, impact panel

### Household Layer (Story's Payoff)
- **F11-F14**: Street check, ground-floor exposure, time-to-safety field, household advisor

### Explanation and Decision
- **F15-F17**: Zone alerts, plain drivers, responder priority index
- **F19**: What-if panel

## Unique Innovations

1. **Compound-timing intelligence**: Explicit tide-blocked drainage modeling
2. **Honest uncertainty**: Calibrated windows, stability metrics
3. **Forecast-driven access loss**: Time-stepped route analysis
4. **Grounded bilingual communication**: Template-based messages
5. **Household leave-by advisor**: Combines flood timing with route closure

## Validation Approach

Training labels come from Poseidon-Sim (simulated data), not real floods. Accuracy measures surrogate fidelity and robustness.

## Demo Story

Build a product so this exact sequence runs from cache, with no internet:

1. Story banner with forecast overlap hook
2. Map lights up with time slider
3. Zone alert with uncertainty and drivers
4. Impact panel (roads, buildings, facilities)
5. "Will it reach our street?" street check
6. "Should we leave now or wait?" household advisor
7. Responder priority list with rank stability

## Implementation Priority

**Solo**: F1→F2→F3→F4→F8→F9→F15→F16→F17→F10→F11→F12→F13→F14→F7→F6
**Team**: Split into Data/Modeling, Geospatial/Decisions, Dashboard/Story teams

## Build Timeline (Solo)

| Hours | Work | Gate |
|-------|------|------|
| 0-1 | Setup, downloads | Every package imports |
| 1-3 | F1 | Zones render on map |
| 3-5.5 | F2 | One scenario gives believable depth map |
| 5.5-9 | F3,F4 | Beats both baselines |
| 9-12 | F8,F9,F15 | Click a zone, see an alert |
| 12-15 | F16,F17,F10 | Priority list and impact panel work |
| 15-17 | F11,F12 | Street check works |
| 17-19 | F7,F6 | Alerts show windows |
| 19-22 | F13,F14 | Street gets verdict and leave-by time |
| 22-23.5 | Freeze code, rehearse, backup video |
| 23.5-24 | Buffer |

## Cut Rules (if behind schedule)

- **Hour 9**: Drop F5 and everything in P2
- **Hour 15**: Drop F6, F18, F20. Keep F7 only if windows work
- **Hour 19**: Simplify time-to-safety field (4 departure times instead of 48)
- **Never cut**: F4 validation and advisor safety check
- **Ahead**: Add F22 (Kannada) before F21 (LLM)

## Dependencies

Required packages:
- numpy, pandas, lightgbm, streamlit, pydeck, h3-py, osm-osc, scikit-learn, matplotlib, seaborn, geopandas

## Data Requirements

- DEM (Digital Elevation Model)
- OSM data (roads, buildings, facilities)
- City configuration (`city.yaml`)
- Weather forecast data (cached)
- Marine/tide data (cached)

## Technical Notes

- Labels are simulated from Poseidon-Sim
- Validation uses event-heldout and spatial-block splits
- Street-level depth is an estimate from zone-level predictions
- Household advisor is decision support, not official evacuation orders
- Everything must run offline from cache

## Success Criteria

P0: Steps 1-5 of walkthrough run from cache
P1a: Step 6 works: household gets verdict and leave-by time

This project is ready to build. Start with data downloads and setup!