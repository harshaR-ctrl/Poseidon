# Poseidon — Implementation Plan

A build spec + implementation record for the **Track 1 Coastal Flood Intelligence MVP**.

> **Naming note.** This document describes how Poseidon is built and how the modules connect. It is not the README or project description.

---

## 0. The ask, and what this is

Poseidon is a laptop-first coastal flood intelligence system for Singularity 2026 Track 1.

The system must answer:

- **Where** will flooding occur?
- **When** will water arrive and peak?
- **How bad** will it be?
- **What** will be affected?
- **Who** should responders reach first?
- **Why** is a zone at risk?
- **How certain** is the prediction?
- **Should a household leave now or wait?**

The brief requires a working flood model covering probability, severity, onset and peak time, an interactive risk map, affected roads/buildings/facilities, response prioritisation and plain-language explanations.

### The MVP has two separate map views

1. **Flood Map**
   - Shows the predicted inundated/flooded area.
   - Answers: *Where will water reach?*
   - Supports the time slider and hour-by-hour flood progression.
   - Overlays roads, buildings and critical facilities.

2. **Severity Heatmap**
   - Shows the predicted **flood severity / depth intensity** by zone.
   - Answers: *How bad is the flooding in each area?*
   - Uses continuous predicted depth where possible and severity classes for interpretation.
   - Can switch between current/forecast depth and peak severity.

These are intentionally separate layers because flood extent and flood severity are different questions.

---

## 1. End-to-end architecture

```text
                         ┌───────────────────────────┐
                         │      DATA SOURCES         │
                         │ Weather / Tide / Surge    │
                         │ DEM / OSM / Land Cover   │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │  DATA PREPROCESSING       │
                         │ Clean + align time/space  │
                         │ H3 zones + terrain        │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │      POSEIDON-SIM         │
                         │ Rain → runoff             │
                         │ Tide-blocked drainage     │
                         │ Coastal inundation        │
                         │ Depth time series         │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │      TRAINING DATA        │
                         │ Features + event labels   │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │     LIGHTGBM MODELS       │
                         │ Probability               │
                         │ Peak depth                │
                         │ Onset 10cm                │
                         │ Onset 30cm                │
                         │ Peak time                 │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │ CALIBRATION + UNCERTAINTY │
                         │ Probability calibration   │
                         │ Depth intervals           │
                         │ Forecast ensemble         │
                         └─────────────┬─────────────┘
                                       │
                     ┌─────────────────┼─────────────────┐
                     ▼                 ▼                 ▼
              PREDICTION          IMPACT            EXPLANATION
                     │                 │                 │
                     ▼                 ▼                 ▼
               Zone output      Roads/buildings     SHAP drivers
               Street output    Facilities          Plain language
                     │                 │                 │
                     └─────────────────┼─────────────────┘
                                       ▼
                         ┌───────────────────────────┐
                         │     DECISION ENGINE      │
                         │ Priority / route /       │
                         │ safe-zone / leave-by     │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │ STREAMLIT + PYDECK UI     │
                         │                           │
                         │ Flood Map                 │
                         │ Severity Heatmap          │
                         │ Timeline                  │
                         │ Alerts                    │
                         │ Street Check               │
                         │ Household Advisor         │
                         │ What-if                    │
                         └───────────────────────────┘
```

The complete application should work from cached files without internet during judging.

---

## 2. Project scope

### Core MVP

The following must be genuinely implemented:

- Flood probability prediction
- Flood onset prediction
- Flood peak-time prediction
- Flood severity / peak depth prediction
- **Flood Map**
- **Severity Heatmap**
- Neighbourhood/H3 risk map
- Affected buildings
- Affected roads
- Critical-facility impact
- Emergency response priority ranking
- SHAP/plain-language explanation
- Prediction uncertainty
- Early-warning alert cards
- Flood Time Machine
- Flood Impact Forecast
- Street Check
- Ground-floor exposure
- Safe-Zone Finder
- Evacuation Countdown
- What-if simulator
- Multi-source data fusion

### Simplified but working

- Smart rescue route
- AI emergency briefing
- Advanced access-loss analysis
- Multi-ensemble rank stability

### Roadmap only

- Sentinel-1 real flood validation
- Real municipal drainage maps
- Real tide-gauge calibration
- SMS/WhatsApp broadcasting
- Multi-city production deployment
- Full hydrodynamic modelling

---

## 3. Study area

Use one coastal study area only.

Recommended constraints:

```text
Study area: <= 10 × 10 km
Terrain resolution: ~30 m
H3: resolution 9
Forecast horizon: 24 h
Primary time step: 1 h
Training scenarios: 800–1,500
Ensemble members: 20–30 for MVP
Road graph: <= 60k nodes
```

The exact location is configurable in:

```text
config/city.yaml
```

Example:

```yaml
city:
  name: Mangaluru
  bbox:
    west: ...
    south: ...
    east: ...
    north: ...

model:
  forecast_hours: 24
  timestep_hours: 1
  plinth_height_m: 0.30

thresholds:
  street_water_m: 0.10
  road_impassable_m: 0.30
  severe_m: 0.60
  extreme_m: 1.00
```

---

## 4. Repository structure

```text
poseidon/
│
├── config/
│   └── city.yaml
│
├── data/
│   ├── raw/
│   │   ├── dem/
│   │   ├── osm/
│   │   └── landcover/
│   ├── processed/
│   │   ├── zones.parquet
│   │   ├── terrain_features.parquet
│   │   ├── infrastructure.parquet
│   │   ├── buildings.parquet
│   │   ├── roads.parquet
│   │   └── graph.graphml
│   └── cache/
│       ├── weather/
│       ├── marine/
│       └── replay/
│
├── src/
│   ├── ingest/
│   │   ├── weather.py
│   │   ├── marine.py
│   │   ├── dem.py
│   │   ├── osm.py
│   │   └── landcover.py
│   │
│   ├── terrain/
│   │   └── features.py
│   │
│   ├── sim/
│   │   ├── poseidon_sim.py
│   │   └── scenarios.py
│   │
│   ├── model/
│   │   ├── features.py
│   │   ├── train.py
│   │   ├── validate.py
│   │   ├── calibrate.py
│   │   ├── infer.py
│   │   └── explain.py
│   │
│   ├── impact/
│   │   ├── buildings.py
│   │   ├── roads.py
│   │   ├── facilities.py
│   │   ├── access.py
│   │   └── priority.py
│   │
│   ├── decision/
│   │   ├── route.py
│   │   ├── safe_zone.py
│   │   ├── evacuation.py
│   │   └── advisor.py
│   │
│   └── narrative/
│       ├── alerts.py
│       ├── briefing.py
│       └── templates/
│
├── app/
│   ├── streamlit_app.py
│   ├── map_layers.py
│   ├── charts.py
│   └── components.py
│
├── notebooks/
│   └── validation.ipynb
│
├── tests/
│   ├── test_sim.py
│   ├── test_thresholds.py
│   ├── test_models.py
│   ├── test_no_leakage.py
│   └── test_route_safety.py
│
├── requirements.txt
└── README.md
```

---

# 5. Step 1 — Data ingestion

## 5.1 Weather

Use cached and optionally live forecast data.

Required fields:

```text
rainfall_1h
rainfall_3h
rainfall_6h
rainfall_12h
rainfall_24h
rainfall_72h
forecast_rainfall
wind_speed
wind_direction
pressure
```

The model should preserve the time dimension rather than collapsing rainfall into one daily value.

---

## 5.2 Tide and marine

Required fields:

```text
current_tide
predicted_high_tide
predicted_low_tide
tidal_range
time_to_high_tide
storm_surge
wave_height
wave_period
```

Supporting astronomical fields:

```text
moon_phase
moon_illumination
days_from_full_moon
days_from_new_moon
```

Moon information is a supporting tidal-cycle feature. Actual tide height and predicted tide remain primary inputs.

If marine API variables are unavailable, use the cached/synthetic tide fallback so the application remains fully offline.

---

## 5.3 DEM / terrain

Use the DEM to derive:

```text
elevation
slope
sink_depth
relative_elevation
distance_to_coast
distance_to_creek
distance_to_river
```

Where feasible:

```text
HAND / local height-above-drainage
```

The DEM is a surface model, so the limitation should be disclosed.

---

## 5.4 OpenStreetMap

Download only the study-area extract.

Use for:

```text
roads
buildings
hospitals
schools
shelters
fire stations
police stations
waterways
land-use tags
street names
```

Street names should be indexed so Street Check works offline.

---

## 5.5 Land cover

Use land cover to estimate:

```text
imperviousness
runoff coefficient
curve number
green/open surface percentage
```

Fallback to OSM land-use data when required.

---

# 6. Step 2 — Spatial preprocessing

## 6.1 Build H3 neighbourhood zones

Convert the study region into H3 resolution-9 cells.

Each zone should have:

```text
zone_id
geometry
place_name
centroid_lat
centroid_lon
```

---

## 6.2 Build terrain feature table

For every H3 zone:

```text
elevation_mean
elevation_min
elevation_max
slope_mean
sink_depth
relative_elevation
distance_to_coast
distance_to_creek
imperviousness
drainage_proxy
```

Save to:

```text
data/processed/terrain_features.parquet
```

---

## 6.3 Build infrastructure tables

### Buildings

```text
building_id
zone_id
geometry
building_type
plinth_height
```

### Roads

```text
road_id
zone_id
geometry
road_type
elevation
```

### Facilities

```text
facility_id
facility_type
zone_id
geometry
importance_score
```

---

# 7. Step 3 — Poseidon-Sim scenario generator

Poseidon-Sim creates synthetic training events because the competition allows simulated data and a complete real-world flood archive is not required for the MVP.

Each scenario contains:

```text
rainfall_curve
tide_curve
storm_surge
antecedent_wetness
terrain
drainage
coastal_connectivity
```

### Simulation pipeline

```text
Rainfall
   ↓
Runoff generation
   ↓
Tide-blocked drainage
   ↓
Excess water
   ↓
Downslope redistribution
   ↓
Coastal water-level inundation
   ↓
Depth time series
   ↓
Zone aggregation
```

---

## 7.1 Rainfall → runoff

Use a simplified SCS Curve Number style runoff calculation.

Inputs:

```text
rainfall
land cover / curve number
antecedent wetness
```

Output:

```text
runoff_depth
```

The simulator is a fast surrogate-data generator, not a calibrated hydrodynamic solver.

---

## 7.2 Tide-blocked drainage

Core coastal mechanism:

```text
Drainage capacity
        ↓
reduced as external coastal water level rises
```

Conceptually:

```text
effective_drainage =
base_drainage ×
(1 - tidal_blocking_factor)
```

The blocking factor increases as:

```text
tide + surge
```

approaches/exceeds the local outfall level.

This is one of Poseidon's central coastal features.

---

## 7.3 Coastal inundation

Compute:

```text
still_water_level =
tide + storm_surge
```

A cell becomes coastally inundated only when:

1. its elevation is below the water level, and
2. it is connected to the coastal water body.

This avoids incorrectly flooding isolated inland depressions just because they are low.

---

## 7.4 Depth labels

For every zone and hour record:

```text
max_depth
hour_of_max_depth
first_hour_depth >= 0.10 m
first_hour_depth >= 0.30 m
```

These become the training targets.

---

# 8. Step 4 — Training dataset

One row represents:

```text
zone + event + time/forecast state
```

Core features:

```text
rain_1h
rain_3h
rain_6h
rain_24h
rain_72h
peak_rain_intensity
time_of_rain_peak

current_tide
high_tide_height
time_to_high_tide
tidal_range
storm_surge
wave_height

tide_rain_overlap
antecedent_rain

elevation
relative_elevation
slope
sink_depth
distance_to_coast
distance_to_creek

imperviousness
drainage_proxy
```

Optional:

```text
river_level
moon_phase
moon_illumination
```

---

# 9. Step 5 — ML prediction layer

Use **LightGBM**.

Five model heads:

### Model 1 — Flood probability

```text
P(depth >= 0.10 m)
```

Output:

```text
0–100%
```

### Model 2 — Peak depth

Quantile regression:

```text
P10
P50
P90
```

### Model 3 — Onset @ 10 cm

When water first reaches the street.

### Model 4 — Onset @ 30 cm

Road-impassable / ground-floor-risk threshold.

### Model 5 — Peak time

Hour of maximum predicted depth.

---

# 10. Step 6 — Calibration and uncertainty

## Probability calibration

Use:

```text
IsotonicRegression
```

to calibrate flood probabilities.

---

## Depth uncertainty

Use:

```text
P10 / P50 / P90
```

and optionally split-conformal adjustment for a reported uncertainty interval.

---

## Forecast ensemble

Run the model across multiple forecast/scenario members.

Aggregate:

```text
mean probability
probability spread
onset P10–P90
peak P10–P90
depth P10–P90
rank stability
```

---

# 11. Step 7 — Prediction output

For every zone:

```text
zone_id
timestamp
flood_probability
peak_depth_p10
peak_depth_p50
peak_depth_p90
severity_class
onset_10cm
onset_30cm
peak_time
confidence
```

For every street:

```text
street_id
zone_id
onset_estimate
peak_time
depth_class
ground_floor_status
```

---

# 12. Step 8 — Flood Map

This is a dedicated map layer and is **not** the same as the severity heatmap.

## Purpose

Answer:

> **Where will water reach?**

## Display

Use the study-area map with:

- predicted flood extent
- H3 zone boundaries
- roads
- buildings
- critical facilities
- coastline/waterways

## Time controls

```text
NOW
+1 h
+2 h
+3 h
...
+24 h
```

Add:

```text
Play
Pause
Time slider
```

As time changes, the flood extent updates.

### Flood Map data logic

```text
predicted_depth > 0.10 m
         ↓
flooded cell/zone
         ↓
map flood layer
```

At each timestep:

```text
current depth
→ current flooded extent
→ affected roads/buildings/facilities
```

---

# 13. Step 9 — Severity Heatmap

This is the second dedicated map layer.

## Purpose

Answer:

> **How severe is the predicted flooding?**

The heatmap should represent **peak depth/severity**, not simply whether a cell is wet.

### Preferred continuous scale

```text
0.00 m
0.10 m
0.30 m
0.60 m
1.00 m
1.50+ m
```

Convert the continuous value into a heatmap across H3 zones.

### Severity classes

```text
< 0.10 m       None
0.10–0.30 m    Minor
0.30–0.60 m    Moderate
0.60–1.00 m    Severe
> 1.00 m       Extreme
```

### Dashboard controls

```text
Severity:
[ Peak Depth ] [ Current Depth ]

Metric:
[ metres ] [ Severity Class ]
```

The heatmap should support hover:

```text
Zone B
Peak depth: 0.72 m
Severity: Severe
Probability: 84%
Onset: 2:40 PM
Peak: 4:10 PM
```

### Important

Do not reuse the same visual encoding for both maps.

```text
Flood Map
= spatial inundation / extent

Severity Heatmap
= depth / severity intensity
```

This makes the dashboard much easier to interpret.

---

# 14. Step 10 — Flood Time Machine

The Flood Time Machine replays one cached scenario.

At every selected hour show:

```text
Rainfall
Tide
Flood probability
Flooded extent
Severity heatmap
Affected roads
Affected buildings
Facility status
```

This should be the main demonstration flow.

---

# 15. Step 11 — Impact analysis

## 15.1 Buildings

Spatially intersect predicted inundation with buildings.

For each building:

```text
flooded
estimated_depth
ground_floor_affected
first_affected_time
```

Ground-floor exposure:

```text
ground_floor_affected =
predicted_depth >= plinth_height
```

Default prototype value:

```text
plinth_height = 0.30 m
```

Editable in config/UI.

---

## 15.2 Roads

For each road segment:

```text
road_id
predicted_depth
closure_time
status
```

Prototype logic:

```text
depth >= 0.30 m
        ↓
road considered impassable
```

For shallower water, optionally reduce route speed rather than immediately closing the edge.

---

## 15.3 Critical facilities

For every:

```text
hospital
shelter
school
fire station
police station
```

derive:

```text
facility_depth
facility_status
access_status
first_affected_time
```

Statuses:

```text
DRY
ACCESS CUT
FLOODED
```

---

# 16. Step 12 — Flood Impact Forecast

Create a future impact timeline:

```text
Now → +1h → +2h → +3h → ... → +24h
```

For every hour:

```text
affected_roads
affected_buildings
affected_facilities
critical_access_loss
```

The dashboard can show:

```text
Next 3 hours

14:00
Roads: 4
Buildings: 38
Facilities: 0

15:00
Roads: 9
Buildings: 74
Facilities: 1

16:00
Roads: 17
Buildings: 132
Facilities: 2
```

---

# 17. Step 13 — Explainability

Use SHAP for the probability model.

For a selected zone:

```text
Flood probability: 84%

Top drivers:
1. Heavy rain overlapping high tide
2. Low elevation
3. Limited drainage
```

The SHAP values are translated to plain-language phrases.

Do not let an LLM invent the explanation.

---

# 18. Step 14 — Early warning alerts

Zone alert format:

```text
HIGH FLOOD RISK — Zone B

Probability: 84%
Peak depth: 0.72 m
Onset: 2:40 PM
Peak: 4:10 PM

Uncertainty:
Onset 2:10–3:20 PM
Depth 0.45–1.02 m

Drivers:
High tide + heavy rain + low elevation

Impact:
17 roads
132 buildings
1 critical facility

Priority:
#1
```

Alert tier can use:

```text
Probability × severity
```

with configurable thresholds.

---

# 19. Step 15 — Emergency Response Priority Ranking

For every zone calculate:

```text
Hazard
Exposure
Vulnerability
Access Loss
Urgency
```

Example:

```text
RPI =
100 × Hazard ×
(
0.30 × Exposure
+ 0.20 × Vulnerability
+ 0.30 × AccessLoss
+ 0.20 × Urgency
)
```

Output:

```text
#1 Zone B    91
#2 Zone C    78
#3 Zone A    64
```

Each row must expose its score breakdown.

---

# 20. Step 16 — Rescue Priority Score

The rescue score is the same decision layer exposed as a simple 0–100 metric.

Factors:

```text
flood severity
population exposure
critical facility exposure
road/access loss
time until onset
```

Use it to sort the responder panel.

---

# 21. Step 17 — Smart Rescue Route

Build a simplified road graph with NetworkX.

For each edge:

```text
open
partially affected
closed
```

When a road exceeds its closure threshold:

```text
remove/disable edge
```

Then compute:

```text
shortest safe route
```

The MVP only needs to find a usable path. No real-time vehicle routing or traffic prediction is required.

---

# 22. Step 18 — Safe-Zone Finder

For a selected street/location:

```text
1. identify current flood state
2. check reachable roads
3. find nearest reachable shelter/hospital
4. calculate distance and estimated travel time
```

Output:

```text
Nearest safe zone:
Shelter X

Distance:
1.2 km

Route:
OPEN

Estimated travel:
14 min
```

If no safe path remains:

```text
NO SAFE ROUTE
```

---

# 23. Step 19 — Evacuation Countdown

Determine:

```text
road_closure_time
-
safety_buffer
=
latest_safe_departure
```

Example:

```text
Road closure: 3:25 PM
Safety buffer: 25 min

LEAVE BY: 3:00 PM
```

If the route is already closed:

```text
ROUTE CUT — MOVE UPSTAIRS
```

The system must never instruct a person to walk or drive through floodwater.

---

# 24. Step 20 — Street Check

User can:

```text
click map
```

or:

```text
type street name
```

Return:

```text
Street:
Temple Road

Zone:
B

Water starts:
2:40 PM

Peak:
4:10 PM

Peak severity:
Severe

Ground floor:
At risk from ~3:15 PM

Route:
Shelter X

Latest safe departure:
3:00 PM
```

---

# 25. Step 21 — Household Advisor

Decision logic:

```text
ground_floor_time = predicted time
                   depth >= plinth height

route_cut_time = latest safe route time

IF ground_floor_time occurs
AND route is still safe:
    LEAVE BY HH:MM

ELSE IF ground-floor flood probability remains low:
    SAFE TO WAIT
    RE-CHECK AT HH:MM

ELSE:
    ROUTE CUT — MOVE UPSTAIRS
```

Always compare:

```text
Leave now
vs
Wait until evening
```

The UI must state:

> Prototype decision support. Not an official evacuation order.

---

# 26. Step 22 — What-If Flood Simulator

Only three sliders are needed for MVP:

```text
Rainfall multiplier
Tide offset
Storm surge offset
```

Example:

```text
Tide:
0.0 m → +0.5 m
```

Then update:

```text
Flood probability
Peak depth
Onset
Peak time
Flood Map
Severity Heatmap
Impact
Priority
```

The What-If view should demonstrate the causal story:

```text
Higher tide
      ↓
less drainage
      ↓
greater depth
      ↓
earlier road closure
      ↓
higher priority
```

---

# 27. Step 23 — Multi-Source Intelligence

Merge:

```text
Weather
Tide
Storm surge
DEM
Land cover
OSM
Population
Historical/synthetic scenarios
```

Do not display each as an isolated model.

All sources should feed a common:

```text
zone + time
```

forecast state.

---

# 28. Step 24 — AI Emergency Briefing

The LLM is not the prediction engine.

It receives a verified facts object:

```json
{
  "zone": "B",
  "probability": 0.84,
  "severity": "Severe",
  "onset": "14:40",
  "peak": "16:10",
  "drivers": [],
  "affected_roads": 17,
  "affected_buildings": 132,
  "critical_facilities": 1,
  "priority": 1,
  "recommended_actions": []
}
```

Then it creates a readable briefing.

Fallback:

```text
Jinja2 deterministic template
```

Numbers always come from the facts object.

---

# 29. Step 25 — Dashboard implementation

Use Streamlit + Pydeck + Plotly.

## Main screen

```text
┌─────────────────────────────────────────────────────┐
│ POSEIDON                                             │
│ COASTAL FLOOD INTELLIGENCE                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│                 FLOOD MAP                           │
│                                                     │
│            [interactive Pydeck map]                 │
│                                                     │
├─────────────────────────────┬───────────────────────┤
│ SEVERITY HEATMAP            │ ZONE ALERT            │
│ [depth / severity]           │ probability           │
│                             │ onset / peak          │
├─────────────────────────────┴───────────────────────┤
│ RAIN + TIDE TIMELINE                                 │
├─────────────────────────────────────────────────────┤
│ FLOOD IMPACT                                         │
├─────────────────────────────────────────────────────┤
│ PRIORITY / STREET CHECK / HOUSEHOLD ADVISOR          │
└─────────────────────────────────────────────────────┘
```

---

## 29.1 Map controls

Provide:

```text
Map:
[ Flood Extent ]
[ Severity Heatmap ]
[ Both ]

Time:
[ slider ]
[ ▶ Play ]
```

### Flood Extent

Show:

```text
flooded cells
flooded zones
road closures
building exposure
facility markers
```

### Severity Heatmap

Show:

```text
peak/current depth intensity
```

with hover information.

---

# 30. Step 26 — Storage

No database is required for MVP.

Use:

```text
Parquet
GeoJSON
Joblib
YAML
```

Core files:

```text
zones.parquet
terrain_features.parquet
infrastructure.parquet
zone_predictions.parquet
edge_closure.parquet
models/*.joblib
replay/*.parquet
```

---

# 31. Step 27 — API layer

Even though Streamlit is the front end, isolate logic into Python modules so the app stays testable.

Minimum internal interfaces:

```text
load_forecast()
generate_scenarios()
predict_zones()
predict_streets()
build_flood_map()
build_severity_heatmap()
calculate_impacts()
calculate_priority()
find_safe_route()
calculate_leave_by()
generate_alert()
generate_briefing()
```

No need for FastAPI in the MVP unless another client requires an HTTP API.

---

# 32. Step 28 — Validation

## Classification

Report:

```text
ROC-AUC
PR-AUC
F1
Brier score
```

## Timing

Report:

```text
MAE onset@10cm
MAE onset@30cm
MAE peak time
```

## Depth

Report:

```text
MAE
P10–P90 interval coverage
```

## Calibration

Show:

```text
Reliability diagram
```

## Generalisation

Use:

```text
event-held-out split
spatial-block split
```

Never randomly split rows from the same flood event into both train and test.

---

# 33. Step 29 — Safety validation

The household advisor is safety-critical.

Measure:

```text
How often did "SAFE TO WAIT"
occur before a real ground-floor flood?

How often did "LEAVE BY"
occur after the route was already closed?
```

These error rates should be shown on the validation slide.

If uncertain, the advisor should become more conservative rather than more confident.

---

# 34. Step 30 — Testing gates

### Gate 1

```text
DEM loads
OSM loads
H3 zones render
```

### Gate 2

```text
One simulator event produces a believable depth map
```

### Gate 3

```text
Models beat simple baselines
```

### Gate 4

```text
Flood Map changes with time slider
```

### Gate 5

```text
Severity Heatmap correctly follows predicted depth
```

### Gate 6

```text
Zone click produces alert + SHAP drivers
```

### Gate 7

```text
Road/building/facility impact works
```

### Gate 8

```text
Street lookup works
```

### Gate 9

```text
Household advisor produces conservative verdict
```

### Gate 10

```text
Entire demo runs offline from cache
```

---

# 35. 24-hour implementation sequence

## Hours 0–1

- Create repository
- Install environment
- Create config
- Begin data downloads
- Freeze dependencies

## Hours 1–3

- DEM processing
- OSM extraction
- H3 zones
- Terrain feature table
- Render first map

## Hours 3–6

- Poseidon-Sim
- Generate 800–1,500 scenarios
- Generate labels
- Verify one event visually

## Hours 6–9

- Train LightGBM heads
- Validate
- Save models
- Add calibration

## Hours 9–11

- Prediction inference
- Build **Flood Map**
- Add time slider

## Hours 11–12.5

- Build **Severity Heatmap**
- Add depth/severity legend
- Add hover details

## Hours 12.5–15

- Building impact
- Road impact
- Facility impact
- Flood Impact Forecast

## Hours 15–17

- SHAP explanation
- Alerts
- Priority ranking

## Hours 17–19

- Street Check
- Ground-floor exposure
- Safe-Zone Finder
- Rescue route

## Hours 19–20.5

- Evacuation Countdown
- Household Advisor

## Hours 20.5–22

- What-If simulator
- Uncertainty Radar
- Multi-source panel

## Hours 22–23

- Emergency briefing
- Dashboard polish
- Offline cache test

## Hours 23–24

- Freeze code
- Rehearse twice
- Record backup
- Final validation slide

---

# 36. Cut rules

### If behind at hour 9

Drop:

```text
advanced calibration
rank stability
LLM briefing
```

Keep:

```text
models
Flood Map
Severity Heatmap
impact
alerts
priority
```

### If behind at hour 15

Simplify:

```text
routing
safe-zone search
what-if
```

### If behind at hour 19

Use only:

```text
departure now
+1 hour
+2 hours
+3 hours
```

for evacuation calculations.

### Never cut

```text
Flood Prediction
Onset
Peak
Severity
Flood Map
Severity Heatmap
Impact
Priority
Explainability
Validation
```

---

# 37. Demo sequence

```text
0:00  Rain + rising tide
      ↓
0:30  Tide/rain overlap
      ↓
1:00  Flood Map starts showing spread
      ↓
1:30  Severity Heatmap reveals deepest zones
      ↓
2:00  Click Zone B
      ↓
      Probability + severity + onset + peak
      ↓
2:30  Show affected roads/buildings/facilities
      ↓
3:00  Show SHAP drivers + uncertainty
      ↓
3:30  Street Check
      ↓
      Ground-floor exposure
      ↓
      Safe route
      ↓
      Leave-by time
      ↓
4:00  Response Priority Ranking
      ↓
4:20  Smart Rescue Route
      ↓
4:40  What-If tide/rain change
      ↓
5:00  Validation + limitations
```

---

# 38. What the judges should understand in one sentence

> **Poseidon predicts not only whether coastal flooding will happen, but where it will spread, how severe it will become, when roads and homes become unsafe, why the model believes it, and what people and responders should do next.**

---

# 39. Honest limitations

State these openly:

- Training labels are primarily generated by Poseidon-Sim.
- Poseidon-Sim is not a calibrated full hydrodynamic solver.
- DEM and drainage are approximations.
- Street-level predictions are estimates derived from spatial modelling.
- Plinth height is configurable unless surveyed data exists.
- Road closure is threshold-based.
- Live data is optional; cached replay is the reliable demo mode.
- Household advice is decision support, not an official evacuation order.
- The system should not be used as a substitute for official disaster-management warnings.

---

# 40. Final implementation principle

The project is complete when one replay can run end-to-end:

```text
Forecast
   ↓
Preprocessing
   ↓
Scenario / model
   ↓
Flood probability
   ↓
Onset + peak
   ↓
Flood Map
   ↓
Severity Heatmap
   ↓
Impacts
   ↓
SHAP explanation
   ↓
Uncertainty
   ↓
Priority
   ↓
Safe route
   ↓
Leave-by decision
   ↓
What-if
   ↓
Emergency briefing
```

The **Flood Map** answers *where the water goes*.

The **Severity Heatmap** answers *how bad the water is*.

Together they form the main visual intelligence layer of Poseidon.
