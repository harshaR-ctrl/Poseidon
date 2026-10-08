# Poseidon — Project Instructions

## Overview

This document contains the specific instructions for working on the Poseidon Coastal Flood Intelligence System. It overrides any default behavior and must be followed exactly.

## Project Context

Poseidon is a laptop-first coastal flood intelligence system for Singularity 2026 Track 1. It predicts when floodwater will reach specific streets and provides actionable household decision support.

**Core Problem**: During heavy rain with rising tide, drains struggle to empty water. The same rainfall that doesn't flood at low tide will flood at high tide.

**Core Story**: A family on the ground floor asks: "Will the water reach our street? When? Should we leave now or wait?"

## Key Requirements

### **Must-Have Features (P0)**
1. **Flood Prediction**: Probability, severity, onset, peak time
2. **Flood Map**: Interactive, time-enabled inundation extent
3. **Severity Heatmap**: Depth/severity intensity visualization
4. **Affected Infrastructure**: Roads, buildings, facilities
5. **Emergency Response**: Priority ranking with breakdown
6. **Plain Explanations**: Why will zones flood? How sure?
7. **Street Check**: Click or type street name → detailed info
8. **Household Advisor**: Leave now / by X / wait / route cut
9. **Uncertainty**: Calibrated probabilities and time windows
10. **Offline Operation**: Full demo from cached files

### **Should-Have (P1a) - Story's Payoff**
11. **Ensemble Forecasts**: Multiple members with calibration
12. **Time-to-Safety Field**: Travel time to reachable shelters
13. **What-If Simulator**: Rain/tide/surge multipliers

### **Polish (P2) - Cut First**
14. **AI Briefing**: Grounded emergency briefing
15. **Kannada Support**: Bilingual templates
16. **Multi-source Intelligence**: Live/replay data fusion

## Architecture Rules

### **Module Responsibilities**
- **ingest/**: Data loading (weather, tide, DEM, OSM, land cover)
- **terrain/**: Terrain feature extraction
- **sim/**: Poseidon-Sim (flood scenario generation)
- **model/**: ML training and inference (LightGBM)
- **impact/**: Impact analysis (buildings, roads, facilities)
- **decision/**: Decision support (advisor, routes, safe zones)
- **narrative/**: Communication (alerts, briefings)

### **Interface Contracts**
- Each module has one clear responsibility
- Well-defined input/output contracts
- Minimal coupling between layers
- Testable in isolation

### **Data Flow**
```
Data Sources → Data Preprocessing → Poseidon-Sim → ML Models → 
Predictions → Impact Analysis → Decision Support → Dashboard
```

## Implementation Guidelines

### **Code Structure**
```
src/
├── ingest/     # Data loading
├── terrain/    # Terrain features
├── sim/        # Flood simulation
├── model/      # ML models
├── impact/     # Impact analysis
├── decision/   # Decision support
└── narrative/  # Communication

app/            # Streamlit dashboard
notebooks/     # Exploration notebooks
 tests/        # Unit/integration tests
```

### **File Naming**
- `snake_case.py` for modules
- `CamelCase` for classes
- `CONSTANT_UPPERCASE` for constants
- `kebab-case.yaml` for configs

### **Import Order**
1. Standard library
2. Third-party packages
3. Local modules

## Development Process

### **Gate System**
Each major milestone has a clear gate before proceeding:

1. **Environment setup**: All imports work, virtual environment active
2. **Data loading**: DEM, OSM load successfully
3. **First scenario**: Believable depth map (low areas wet, hills dry)
4. **Flood Map**: Interactive time slider works
5. **Severity Heatmap**: Hover shows correct information
6. **Street check**: Location lookup works
7. **Household advisor**: Conservative verdicts
8. **Full demo**: Runs offline from cache

### **Cut Rules**
- **Hour 9**: Drop F5, F21 (advanced calibration, LLM briefing)
- **Hour 15**: Drop F6, F18, F20 (simplified routing)
- **Hour 19**: Use only 4 departure times for evacuation
- **Never cut**: F4 validation and advisor safety check

### **Success Metrics**
- **Model**: ROC-AUC > 0.7 (event-heldout)
- **Timing**: MAE < 1 hour for onsets
- **Depth**: MAE < 0.1m
- **Safety**: Conservative advisor error rates

## Testing Strategy

### **Unit Tests**
- Each module tested in isolation
- Mock external dependencies
- Edge cases covered

### **Integration Tests**
- Full demo flow tested
- Component interactions validated
- Offline operation verified

### **Performance Gates**
- Model inference: <1 second for all ensemble members
- Map rendering: <500ms update
- Household advisor: <50ms

## Documentation

### **Required Documents**
1. **README.md**: Project overview and quick start
2. **architecture.md**: System architecture and design decisions
3. **implementation_plan.md**: Step-by-step implementation plan
4. **CLAUDE.md**: This document with instructions

### **Code Comments**
- Explain non-obvious decisions
- Document API contracts
- Note limitations and assumptions
- Add `ponytail:` comments for deliberate simplifications

## Special Instructions

### **Ponytail Mode**
- Apply laziness systematically
- Use stdlib and native features first
- Skip unrequested abstractions
- Delete before adding
- Shortest working diff wins

### **Offline Operation**
- Cache everything needed for demo
- Graceful fallbacks when live data unavailable
- Validate cached data integrity

### **Safety First**
- Household advisor conservative
- When uncertain, err on safe side
- Always provide evening comparison
- Never advise walking through water

### **Validation**
- Training labels from Poseidon-Sim
- Event-heldout and spatial-block splits
- Advisor safety checks critical
- Show error rates publicly

## Repository Management

### **Git Workflow**
- Feature branches for each major milestone
- `main` always contains working demo
- Never commit large data files
- Use .gitignore appropriately

### **Development Branches**
- `feature/xxx`: Specific feature implementation
- `bug/xxx`: Bug fixes
- `hotfix/xxx`: Urgent fixes

## Final Requirements

### **Demo Story**
Build so this exact sequence runs from cache, with no internet:

1. **0:00** Story slide
2. **0:30** Forecast banner and timing strip
3. **1:00** Flood Map with time slider
4. **1:45** Click Zone B → alert card
5. **2:30** Show affected infrastructure
6. **3:15** Street Check
7. **3:45** Priority list and rank stability
8. **4:15** What-If (if built)
9. **4:45** Validation slide
10. **5:00** Conclusion

### **Critical Success Factors**
1. **Working prototype**: P0 + P1a functional
2. **Offline demo**: Complete demo runs without internet
3. **Conservative advisor**: Safety-critical component
4. **Validated uncertainty**: Honest error reporting
5. **Explainable**: Plain-language drivers
6. **Interactive**: Map, timeline, what-if controls

## What Judges See

### **Technical Depth**
- **Model quality**: ROC-AUC, calibration, uncertainty
- **Spatial analysis**: Zone-level predictions, street-level lookup
- **Temporal intelligence**: Onset/peak windows, route closure
- **Compound floods**: Tide-blocked drainage modeling

### **User Experience**
- **Dashboard**: Flood Map + Severity Heatmap
- **Timeline**: Rain + tide curves with overlap highlight
- **Alerts**: Brief's format with uncertainty
- **Street Check**: Household decision support
- **What-If**: Causal story demonstration

### **Robustness**
- **Offline**: Cache-first design
- **Safety**: Conservative advisor
- **Validation**: Multiple splits, error reporting
- **Documentation**: Clear instructions and examples

## Remember

This is **Track 1** of Singularity 2026. The system must:
1. **Work**: From cached files, offline
2. **Predict**: Street-level timing and severity
3. **Advise**: Conservative household decisions
4. **Explain**: Why and how sure
5. **Show**: Clear visual intelligence

**The family's morning depends on it.**

---

**Poseidon's mission: "Know before the water arrives."

**Implement carefully. Validate often. Be conservative.**