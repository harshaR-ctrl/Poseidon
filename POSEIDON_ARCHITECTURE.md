# Poseidon — System Architecture

## Overview

Poseidon is a coastal flood intelligence system built for offline operation during Singularity 2026. It predicts when floodwater will reach specific streets and provides actionable household decision support.

## Architecture Philosophy

### Core Principles
1. **Offline-first**: Everything must work from cached files without internet
2. **Modularity**: Separate layers for data, simulation, modeling, impact analysis, explanation, and decision support
3. **Clear interfaces**: Each layer has well-defined inputs/outputs with minimal coupling
4. **Testable**: Code is organized into testable modules with clear APIs

### Design Decisions

#### 1. Why H3 zones?
- Equal-area cells simplify spatial analysis
- Efficient grid for zone aggregation
- Natural boundary for administrative regions
- Good balance between detail and computational cost

#### 2. Why reduced-physics simulator?
- Speed is essential for generating 800-1,500 scenarios
- "Believable" is sufficient; hydrological accuracy can come later
- Explicit tide-blocked drainage captures the key coastal mechanism
- Training labels are simulated anyway

#### 3. Why LightGBM?
- Fast training/inference
- Handles heterogeneous features well
- Built-in support for quantile regression
- Interpretable compared to deep learning
- Good performance on tabular spatial data

#### 4. Why two map layers?
- Flood extent vs. severity are different questions
- Visual clarity: wet/dry vs. depth intensity
- Prevents confusion between "is flooded" and "how bad is it"
- Easier to explain each layer independently

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DATA SOURCES                        │
│ Weather / Tide / Surge                                 │
│ DEM / OSM / Land Cover                                 │
│ Population                                             │
└───────────────────────┬─────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   DATA PIPELINE                        │
│   Raw → Clean → Align → Features → Labels              │
└───────────────────────┬─────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 DATA STORAGE LAYER                     │
│ zones.parquet                                         │
│ terrain_features.parquet                              │
│ infrastructure.parquet                                │
│ zone_predictions.parquet                               │
│ edge_closure.parquet                                   │
│ models/ (LightGBM *.joblib)                            │
│ replay/ (scenario parquet)                             │
└───────────────────────┬─────────────────────────────────┘
                          ▼
┌─────────────────┬─────────────────┬─────────────────────┐
│   CORE ENGINE   │   IMPACT LAYER │     EXPLANATION    │
│                 │                │                    │
│  Poseidon-Sim  │  Buildings     │  SHAP + Templates   │
│                │                │                    │
│                │  Roads         │  Counterfactuals    │
│                │                │                    │
│                │  Facilities    │  Bilingual support │
│                │                │                    │
│                │  Access loss   │                    │
│                │  Priority      │                    │
└─────────────────┴─────────────────┴─────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 DECISION ENGINE                        │
│ Household advisor, Responder priority, Safe zones     │
│                                                         │
│      Time-to-safety field                              │
│      Leave-by calculation                               │
│      Route finding                                      │
└───────────────────────┬─────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     PRESENTATION                       │
│    Streamlit + Pydeck + Plotly                         │
│                                                         │
│    Flood Map (extent)                                   │
│    Severity Heatmap (depth)                             │
│    Timeline (rain + tide)                               │
│    Alerts                                               │
│    Street Check                                         │
│    Household Advisor                                    │
│    What-if                                              │
│    Emergency briefing                                    │
└─────────────────────────────────────────────────────────┘
```

## Module Details

### Core Engine

#### poseidon_sim.py
- **Responsibility**: Generate synthetic flood scenarios
- **Key features**:
  - Curve-number runoff calculation
  - **Tide-blocked drainage**: `capacity × (1 − sigmoid((tide − level)/s))`
  - Connectivity-aware coastal flooding
  - Depth time series per zone
- **Inputs**: Rainfall, terrain, tide, surge, scenarios
- **Outputs**: Zone labels (P(flood), peak depth, onset@10cm, onset@30cm, peak time)

#### model/
- **train.py**: LightGBM with 5 heads (probability, depth quantiles, onsets, peak time)
- **calibrate.py**: Isotonic regression for probability, split-conformal for depth intervals
- **infer.py**: Ensemble prediction across multiple forecast members
- **explain.py**: SHAP values for model interpretability

### Impact Layer

#### impact/
- **buildings.py**: Building-level flood exposure using plinth heights
- **roads.py**: Road closure based on depth thresholds (0.30m)
- **facilities.py**: Critical facility status tracking
- **access.py**: Time-to-safety field calculation via multi-source Dijkstra
- **priority.py**: Responder Priority Index with breakdown

### Decision Engine

#### decision/
- **advisor.py**: Household decision logic with conservative safety margin
- **route.py**: Safe route finding on flooded graph
- **safe_zone.py**: Nearest shelter/hospital lookup
- **evacuation.py**: Leave-by time calculation

### Presentation Layer

#### app/
- **streamlit_app.py**: Main dashboard with all components
- **map_layers.py**: Flood Map and Severity Heatmap
- **charts.py**: Timeline and other visualizations
- **components.py**: Reusable UI components

### Narrative Layer

#### narrative/
- **alerts.py**: Zone alert cards with uncertainty
- **briefing.py**: Grounded emergency briefing with template fallback

## Data Flow

### Stage 1: Data Ingestion
1. **Weather**: Rainfall, wind, pressure
2. **Tide/Marine**: Current tide, predictions, surge
3. **Terrain**: DEM with elevation, slope, etc.
4. **Infrastructure**: OSM roads, buildings, facilities
5. **Land cover**: Imperviousness, curve numbers

### Stage 2: Spatial Preprocessing
1. **H3 zones**: Grid over study area
2. **Terrain features**: For each zone, terrain metrics
3. **Infrastructure tables**: Buildings, roads, facilities per zone
4. **Street index**: For offline Street Check

### Stage 3: Simulation
1. Generate 800-1,500 scenarios
2. Run Poseidon-Sim for each
3. Generate labels (5 heads)
4. Save as training dataset

### Stage 4: Training & Calibration
1. Train LightGBM models
2. Calibrate probabilities and depth intervals
3. Validate with event-heldout and spatial-block splits

### Stage 5: Prediction
1. Load cached replay data or live forecasts
2. Run inference on all model members
3. Generate calibrated outputs with uncertainty

### Stage 6: Impact & Decision
1. Apply predictions to infrastructure
2. Calculate road closures and building exposure
3. Run time-to-safety calculations
4. Generate household advisor and responder priority
5. Create explanations

### Stage 7: Presentation
1. Streamlit app serves all components
2. Interactive maps with controls
3. Real-time What-if simulations
4. Emergency briefings

## Key Interface Contracts

### Module: poseidon_sim.py
```python
# Input
timestamp: datetime
weather_data: WeatherData
tide_data: TideData
terrain_data: TerrainData

# Output
scenario_labels: ScenarioLabels  # zone + time + targets
```

### Module: model/infer.py
```python
# Input
features: FeatureMatrix

# Output
predictions: PredictionResults  # 5 heads calibrated
```

### Module: impact/access.py
```python
# Input
predictions: PredictionResults
infrastructure: InfrastructureData
departure_times: List[datetime]

# Output
accessibility: AccessibilityResults  # route status per node/time
```

### Module: decision/advisor.py
```python
# Input
predictions: PredictionResults
accessibility: AccessibilityResults
location: HouseholdLocation
floor: int
plinth_height: float

# Output
household_advice: HouseholdAdvice
```

## Error Handling

### Philosophy
- **Conservative by default**: When uncertain, err on the safe side
- **Graceful degradation**: If a component fails, use fallback values
- **Transparency**: Always show uncertainty levels
- **Validation**: Critical components have multiple safety checks

### Key Safeguards

#### Household Advisor Safety
```python
def conservative_advisor(predictions, accessibility):
    # Never recommend waiting if ground floor will definitely flood
    if P(ground_floor_flood) > 0.9:
        return "LEAVE NOW"
    
    # Never recommend leaving if no safe route exists
    if no_safe_route_exists():
        return "ROUTE CUT, MOVE UPSTAIRS"
    
    # Always provide evening comparison
    return "compare evening scenario"
```

#### Data Validation
- All infrastructure files loaded and validated before processing
- Geographic bounds checked against study area
- Model predictions sanity-checked against simulator labels

## Testing Strategy

### Unit Tests (per module)
- poseidon_sim: One scenario produces believable depth map
- model: Individual heads produce expected output ranges
- impact: Building exposure calculated correctly
- decision: Household advisor conservative

### Integration Tests (key flows)
- Full demo: Run from cache to end-to-end
- What-if: Parameters update all dependent components
- Validation: Event-heldout and spatial-block splits work

### Performance Gates
- Model inference: <1 second for all ensemble members
- Map rendering: <500ms update time
- Household lookup: <50ms

## Offline Operation

### Cache Structure
```
data/
├── cache/
│   ├── weather/           # Historical forecasts
│   ├── marine/           # Tide/surge data
│   └── replay/           # Full scenario runs
├── processed/           # Precomputed features
├── models/             # Trained LightGBM models
└── zone_predictions.parquet
```

### Startup Flow
1. Check cache files exist
2. Load processed data
3. Load models
4. Load replay scenarios
5. Serve Streamlit app

## Scalability Considerations

### Design for Growth
- **Modular storage**: New data types can be added without breaking existing modules
- **Config-driven**: All parameters in `config/city.yaml`
- **Pipeline-friendly**: Each stage can run independently
- **Validation-first**: Strong validation before each stage

### Future Extensibility
- Swap simulator for hydrodynamic model
- Add live weather APIs
- Expand to multiple cities
- Add SMS/WhatsApp alerts
- Real-time drainage maps
- Sentinel-1 validation

## Performance Optimizations

### Memory Management
- Process data in chunks for large H3 grids
- Use Parquet for column-efficient storage
- Stream forecast data when possible

### Computation Speed
- **LightGBM**: Tree boosting, fast inference
- **Dijkstra**: Multi-source run once per departure window
- **Vector operations**: NumPy/Pandas for bulk calculations

### I/O Efficiency
- All heavy data loaded once at startup
- Use joblib for model persistence
- Parquet format for columnar efficiency

## Key Technical Insights

### Why This Architecture Works
1. **Separation of concerns**: Each module has one clear responsibility
2. **Clear data contracts**: Minimal coupling between layers
3. **Testable components**: Each piece can be tested independently
4. **Gradual refinement**: Start simple, add complexity as needed
5. **Offline robustness**: Cache-first ensures reliability

### Trade-offs
- **Simulated training data**: Loss of real-world validation
  - **Mitigation**: Strong calibration and multiple validation splits
- **Reduced-physics**: Less accurate than full hydrodynamic models
  - **Mitigation**: Explicit tide-blocked drainage captures key coastal mechanism
- **Zone-level predictions**: Street-level estimates have error
  - **Mitigation**: Plinth height configurable, uncertainty clearly shown

### Deployment Strategy
1. **Local setup**: Full system runs on laptop for demo
2. **Docker**: Containerized for easy deployment
3. **Cloud**: API layer for remote access
4. **Mobile**: Progressive web app for field use

## Summary

Poseidon's architecture balances technical feasibility with user needs. By:

1. **Using the right tool for the job**: Python ecosystem, LightGBM, Streamlit
2. **Maintaining clear boundaries**: Well-defined module interfaces
3. **Prioritizing offline operation**: Cache-first design
4. **Conservative safety**: Household advisor erring on safe side
5. **Test-driven development**: Gates ensure working functionality

This architecture delivers a functional prototype that meets the Track 1 requirements while remaining maintainable and extensible for future enhancement.

---

**Architecture validated against requirements:**
- [x] Offline operation
- [x] P0 + P1a functionality
- [x] Time window predictions
- [x] Street-level check
- [x] Household advisor
- [x] Responder priority
- [x] Plain-language explanations
- [x] Compound flood intelligence
- [x] Conservative decision support
- [x] Interactive dashboard