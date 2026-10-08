# Poseidon — Implementation Plan

## Overview

This plan outlines the step-by-step implementation of the Poseidon Coastal Flood Intelligence System, focusing on building the MVP (P0) plus the story's payoff (P1a) within the 24-hour constraint. The plan is organized chronologically and includes specific gates, cut rules, and validation requirements.

## Implementation Priority

### Core Philosophy
1. **Offline-first**: Everything must work from cached files
2. **Believable simulation**: Poseidon-Sim captures essential physics
3. **Fast surrogate models**: LightGBM for speed and interpretability
4. **Conservative decisions**: Household advisor errs on safety side
5. **Test-driven gates**: Each major milestone has clear validation

### Implementation Order (Solo)
**Hours 0-23**: F1→F2→F3→F4→F8→F9→F15→F16→F17→F10→F11→F12→F13→F14→F7→F6

### Team Structure (if 2-3 people)
- **Data/Modeling**: F1, F2, F3, F4, F5, F6, F7
- **Geospatial/Decisions**: F10, F11, F12, F13, F14, F17, F18
- **Dashboard/Story**: F8, F9, F15, F16, F19, demo script

## Phase 1: Setup (Hours 0-1)

### Tasks
1. **Repository initialization** (~15 min)
   - Create src/, data/, notebooks/, tests/ structure
   - Add .gitignore with appropriate patterns
   - Initialize git repo (unless already initialized)

2. **Environment setup** (~30 min)
   - Create virtual environment
   - Install required packages from requirements.txt
   - Test all package imports

3. **Configuration** (~15 min)
   - Create config/city.yaml with study area
   - Set up default parameters (plinth_height, thresholds)
   - Create example data configuration

4. **Data download setup** (~30 min)
   - Start downloading cached data (weather, marine, terrain, OSM)
   - Monitor downloads while coding

### Gates
- **Gate 1**: All packages import successfully
- **Gate 2**: Repository structure exists
- **Gate 3**: Config loads without error

### Cut Rules
- **Behind by hour 1**: Skip advanced calibration and LLM features

## Phase 2: Data Preprocessing (Hours 1-3)

### Tasks
1. **DEM Processing** (F1) (~45 min)
   - Load DEM and compute terrain features
   - Create elevation, slope, sink depth, HAND
   - Distance to coast/creek calculations

2. **OSM Processing** (F1) (~45 min)
   - Extract study area from OSM
   - Build road, building, facility tables
   - Create street name index for offline lookup

3. **H3 Zoning** (F1) (~30 min)
   - Grid study area with H3 resolution-9
   - Assign place names to zones
   - Save zones.parquet

4. **Terrain Features Table** (F1) (~30 min)
   - Create terrain_features.parquet
   - Include all zone-level terrain metrics

### Gates
- **Gate 4**: DEM loads, OSM loads, H3 zones render on map
- **Gate 5**: First zone shows terrain features

### Cut Rules
- None for this phase

## Phase 3: Scenario Generation (Hours 3-6)

### Tasks
1. **Poseidon-Sim Implementation** (F2) (~90 min)
   - Implement curve-number runoff
   - Add tide-blocked drainage formula
   - Add connectivity-aware coastal flooding
   - Generate 800-1,500 scenarios

2. **Label Generation** (F2) (~30 min)
   - For each zone, compute depth time series
   - Label: P(flood), peak depth, onset@10cm, onset@30cm, peak time
   - Save scenario data

3. **Visual Validation** (~15 min)
   - Verify one scenario produces believable depth map
   - Check: low areas wet, hills dry
   - Confirm tide-blocking effect visible

### Gates
- **Gate 6**: One scenario produces believable depth map
- **Gate 7**: Tide-blocking mechanism visible

### Cut Rules
- None for this phase

## Phase 4: Model Training (Hours 6-9)

### Tasks
1. **Model Implementation** (F3) (~60 min)
   - Create model features from terrain + forecast + tide features
   - Implement five LightGBM heads:
     - Flood probability (classifier)
     - Peak depth (quantiles: P10, P50, P90)
     - Onset@10cm (regressor)
     - Onset@30cm (regressor)
     - Peak time (regressor)

2. **Validation Suite** (F4) (~45 min)
   - Event-heldout split (never mix same event in train/test)
   - Spatial-block split
   - Baseline comparisons (elevation-only, rain-only)
   - Metrics: ROC-AUC, PR-AUC, F1, Brier, MAE (timing), MAE (depth)

3. **Model Saving** (~15 min)
   - Save LightGBM models as *.joblib
   - Save validation results
   - Create model validation report

### Gates
- **Gate 8**: Models beat both baselines
- **Gate 9**: Validation shows reasonable performance

### Cut Rules
- None for this phase

## Phase 5: Prediction Layer (Hours 9-12.5)

### Tasks
1. **Inference Engine** (F6, F7) (~60 min)
   - Load cached replay data or live forecasts
   - Run ensemble of model members
   - Calibrate probabilities and depth intervals
   - Output zone predictions with uncertainty

2. **Flood Map** (F8) (~30 min)
   - Create Pydeck layer for flood extent
   - Add time slider and play controls
   - Show: flooded cells, zones, roads, buildings, facilities

3. **Severity Heatmap** (F9) (~30 min)
   - Create heatmap for peak depth/severity
   - Support: current depth vs. peak severity toggle
   - Add hover details

4. **Zone Alerts** (F15) (~30 min)
   - Create alert cards with brief's format
   - Include: probability, depth, onset/peak windows, drivers
   - Add uncertainty ranges

### Gates
- **Gate 10**: Flood Map changes with time slider
- **Gate 11**: Severity Heatmap correctly follows predicted depth
- **Gate 12**: Zone click produces alert + SHAP drivers

### Cut Rules
- **Behind by hour 12**: Drop advanced calibration, rank stability, LLM briefing

## Phase 6: Impact & Street Level (Hours 12.5-19)

### Tasks
1. **Infrastructure Impact** (F10) (~45 min)
   - Building exposure using plinth heights
   - Road closure at 0.30m depth threshold
   - Facility status tracking
   - Create impact panel

2. **SHAP Explanation** (F16) (~30 min)
   - Generate SHAP values for probability model
   - Convert to plain-language drivers
   - Integrate into alert cards

3. **Priority Ranking** (F17) (~30 min)
   - Calculate Responder Priority Index
   - Show: Hazard × (exposure, vulnerability, access loss, urgency)
   - Add weight sliders, per-row breakdown

4. **Street Check** (F11, F12) (~45 min)
   - Click map or type street name lookup
   - Show: onset, peak, severity, ground-floor status
   - Add plinth height selector, floor toggle

### Gates
- **Gate 13**: Building, road, facility impact works
- **Gate 14**: Street lookup works
- **Gate 15**: Household advisor produces conservative verdict

### Cut Rules
- **Behind by hour 15**: Simplify routing, safe-zone search, what-if
- **Behind by hour 19**: Use only 4 departure times (now, +1h, +2h, +3h)

## Phase 7: Decision & Safety (Hours 19-20.5)

### Tasks
1. **Time-to-Safety Field** (F13) (~30 min)
   - Multi-source Dijkstra from shelters/hospitals
   - Calculate travel time to nearest accessible facility
   - Compute for each 30-minute departure window

2. **Household Advisor** (F14) (~45 min)
   - Implement verdict logic:
     - Leave now / Leave by hh:mm
     - Safe to wait, re-check at hh:mm
     - Route cut, move upstairs
   - Add "decision support, not official order" notice
   - Include "someone needs assistance" toggle
   - Add evening comparison

### Gates
- **Gate 16**: Household advisor produces conservative verdict
- **Gate 17**: Full decision support flows (ground floor + route)

### Cut Rules
- None for this phase

## Phase 8: What-If & Uncertainty (Hours 20.5-22)

### Tasks
1. **What-If Simulator** (F19) (~30 min)
   - Three sliders: rainfall multiplier, tide offset, surge offset
   - Re-run model with modified parameters
   - Update all dependent components instantly

2. **Uncertainty Radar** (~15 min)
   - Show probability spread across ensemble
   - Visualize: onset, peak, depth intervals
   - Add reliability indicators

3. **Multi-Source Panel** (~15 min)
   - Display active sources (live vs. cached)
   - Show data freshness, forecast horizon
   - Add fallback notifications

### Cut Rules
- **Behind by hour 21**: Skip uncertainty radar, keep what-if

## Phase 9: Demo & Validation (Hours 22-23.5)

### Tasks
1. **Emergency Briefing** (~30 min)
   - Create grounded briefing from facts-JSON
   - Add template fallback for LLM errors
   - Ensure numbers verified against facts

2. **Dashboard Polish** (~30 min)
   - Combine all components into Streamlit app
   - Add styling and layout improvements
   - Test responsive design

3. **Offline Cache Test** (~30 min)
   - Verify full demo runs without internet
   - Test replay from cached data
   - Validate all components work offline

4. **Rehearsal** (Multiple runs)
   - Run complete demo three times
   - Time each run
   - Document any issues

5. **Backup Recording** (~15 min)
   - Record 5-minute demo backup
   - Ensure video quality acceptable

### Gates
- **Gate 18**: Entire demo runs offline from cache
- **Gate 19**: Demo runs within time limit (5 min)
- **Gate 20**: Rehearsal successful, backup recorded

### Cut Rules
- **Behind by hour 23**: Skip emergency briefing, skip backup video

## Phase 10: Validation & Final (Hours 23.5-24)

### Tasks
1. **Final Validation** (~30 min)
   - Run all validation metrics
   - Check advisor safety requirements
   - Validate advisor error rates
   - Generate validation report

2. **Code Freeze** (~15 min)
   - Review all changes
   - Freeze implementation
   - Create deployment instructions

3. **Final Documentation** (~15 min)
   - Update README
   - Document major decisions
   - Create deployment guide

### Gates
- **Gate 21**: All validation passes
- **Gate 22**: Advisor safety checks OK
- **Gate 23**: Demo ready for submission

## Resource Requirements

### Personnel (Solo)
- **Total time**: 24 hours
- **Peak focus**: Hours 17-22 (complex integration)
- **Break points**: Hours 9, 15, 19, 23

### Technical
- **Hardware**: Laptop with SSD, 16GB RAM minimum
- **Storage**: 50GB free (for data cache)
- **Network**: Required only for initial downloads

## Risk Mitigation

### Technical Risks
1. **Model performance poor**
   - **Mitigation**: Strong baselines, spatial/event splits
   - **Fallback**: Use simpler models, focus on interpretation

2. **Code complexity**
   - **Mitigation**: Incremental gates, unit tests for each module
   - **Fallback**: Skip advanced features, focus on MVP

3. **Data issues**
   - **Mitigation**: Strong validation, fallback to synthetic data
   - **Fallback**: Simplify study area, reduce feature set

### Schedule Risks
1. **Behind schedule**
   - **Mitigation**: Aggressive cut rules, focus on MVP
   - **Fallback**: Submit P0, document remaining features

2. **Integration issues**
   - **Mitigation**: Early testing, component isolation
   - **Fallback**: Simplify integration, focus on working demo

## Success Criteria

### Must Have (P0)
- [ ] Flood probability prediction
- [ ] Flood onset prediction
- [ ] Flood peak-time prediction
- [ ] Flood severity prediction
- [ ] Flood Map (interactive, time-enabled)
- [ ] Severity Heatmap (hover details)
- [ ] Affected buildings, roads, facilities
- [ ] Emergency response priority
- [ ] Plain-language explanations
- [ ] Prediction uncertainty
- [ ] Street check with ground-floor exposure
- [ ] Household advisor with leave-by times

### Should Have (P1a)
- [ ] Ensemble windows + calibration
- [ ] Time-to-safety field
- [ ] What-if simulator

### Bonus
- [ ] Rank stability
- [ ] AI emergency briefing
- [ ] Kannada support
- [ ] Live-data toggle

## Testing Strategy

### Unit Tests
- DEM processing: Elevation calculations correct
- OSM loading: All infrastructure types found
- H3 zoning: All cells covered, no overlaps
- Model inference: Output ranges reasonable
- Decision logic: Conservative verdicts

### Integration Tests
- Full demo run: Everything loads offline
- Component integration: Alert + map + street check
- What-if updates: All dependent components update
- Safety checks: Advisor conservative

### Validation Tests
- Event-heldout: ROC-AUC > 0.7
- Spatial-block: Consistent across zones
- Timing: MAE < 1 hour for onsets
- Depth: MAE < 0.1m
- Advisor: Safe-to-wait error < 5%

## Deployment Instructions

### Local Setup
1. Clone repository
2. Run `python setup.py` or `pip install -r requirements.txt`
3. Download data (first time only)
4. Run `streamlit run app/streamlit_app.py`

### Docker (if needed)
```dockerfile
FROM python:3.9-slim
WORKDIR /app
copy requirements.txt .
run pip install -r requirements.txt
copy . .
CMD ["streamlit", "run", "app/streamlit_app.py"]
```

## Monitoring & Maintenance

### Health Checks
- Model inference time < 1 second
- Map rendering < 500ms
- Household advisor response < 50ms
- All components load offline

### Validation Reports
- Generate after each major milestone
- Include: performance metrics, error analysis, safety checks
- Update before final submission

## Post-Hackathon

### Immediate
- Freeze code, commit all changes
- Create deployment documentation
- Record demo video for review

### Short-term
- Add live weather API integration
- Expand to multiple cities
- Improve UI/UX based on user feedback
- Add Sentinel-1 validation

### Long-term
- Full hydrodynamic model replacement
- Real municipal drainage maps
- SMS/WhatsApp alerts
- Multi-city production deployment

---

**Note**: This plan is adaptive. Gates can shift if critical issues are discovered. Always prioritize MVP requirements over nice-to-haves when cutting scope.

**Implementation starts now. Time to build!**