# Poseidon — Coastal Flood Intelligence System

## Overview

Poseidon is an AI system for coastal flood prediction that helps households and responders prepare for compound flooding events (heavy rain + rising tide). It predicts when floodwater will reach specific streets and provides actionable household decision support.

## Key Features

### **Core Capabilities**
- **Street-level predictions**: When will water reach YOUR street?
- **Time windows**: Onset and peak as precise time ranges
- **Household advisor**: Leave now / by X / wait until evening
- **Responder priority**: Who needs help first and by which road
- **Plain explanations**: Why will this zone flood? How sure are we?

### **Technical Innovations**
- **Tide-blocked drainage**: Explicit modeling of how high tide stops drains
- **Compound timing intelligence**: Models rain+tide interaction
- **Honest uncertainty**: Calibrated probabilities and windows
- **Decision support**: Safety-first household advisor
- **Offline operation**: Full demo runs without internet

## Quick Start

### Requirements
- Python 3.9+
- 16GB RAM, SSD storage recommended
- 50GB free space for data cache

### Installation

# Clone repository
cd /path/to/poseidon

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt

# Run the unified seed script (generates terrain, runs Poseidon-Sim, and trains the XGBoost model)
python seed_and_train.py

# Start the dashboard
streamlit run app/streamlit_app.py
```

### Usage

1. **Demo Mode**: Load cached replay data (recommended for judging)
2. **Live Mode**: Connect to live weather APIs (optional)
3. **What-If**: Use sliders to explore scenarios

## Directory Structure

```
poseidon/
├── config/              # Configuration files
│   └── city.yaml        # Study area and parameters
│
├── data/                # Data storage
│   ├── cache/          # Cached forecasts and scenarios
│   ├── processed/      # Preprocessed features
│   └── raw/            # Raw downloads
│
├── src/                 # Source code
│   ├── ingest/         # Data ingestion modules
│   ├── terrain/       # Terrain processing
│   ├── sim/           # Poseidon-Sim
│   ├── model/         # ML models
│   ├── impact/        # Impact analysis
│   ├── decision/      # Decision support
│   └── narrative/     # Communication modules
│
├── app/                 # Streamlit application
│   ├── streamlit_app.py  # Main dashboard
│   ├── map_layers.py     # Map components
│   ├── charts.py        # Visualizations
│   └── components.py    # UI components
│
├── notebooks/           # Jupyter notebooks for exploration
├── tests/              # Unit and integration tests
└── docs/              # Documentation
```

## Core Implementation Flow

```
Data Sources → Data Preprocessing → Poseidon-Sim → ML Models → 
Predictions → Impact Analysis → Decision Support → Dashboard
```

### Key Modules

1. **Data Preprocessing**
   - DEM processing (terrain features)
   - OSM extraction (roads, buildings, facilities)
   - H3 zoning

2. **Poseidon-Sim**
   - Curve-number runoff calculation
   - **Tide-blocked drainage**: `capacity × (1 − sigmoid((tide − level)/s))`
   - Connectivity-aware coastal flooding

3. **Machine Learning**
   - Five-head LightGBM model
   - Calibration and uncertainty quantification
   - SHAP explanations

4. **Impact Analysis**
   - Building exposure
   - Road closure prediction
   - Facility status tracking
   - Time-to-safety calculation

5. **Decision Support**
   - Household advisor (conservative)
   - Responder priority index
   - Safe zone finder
   - Evacuation countdown

6. **Presentation**
   - Flood Map (extent)
   - Severity Heatmap (depth)
   - Timeline (rain + tide)
   - Alerts and explanations
   - Street check
   - What-if simulator

## Architecture Principles

### **Offline-First**
- Everything works from cached files
- No internet required during judging
- Graceful fallback when live data unavailable

### **Conservative Safety**
- Household advisor errs on safe side
- When uncertain, recommend action over inaction
- Always provide evening comparison

### **Clear Interfaces**
- Each module has one clear responsibility
- Well-defined input/output contracts
- Minimal coupling between layers

### **Testable**
- Unit tests for each module
- Integration tests for key flows
- Gates before major milestones

## Technical Details

### Study Area
- **Size**: ≤ 10×10 km
- **Resolution**: 30m terrain, H3 resolution-9 (~0.1km²)
- **Location**: Mangaluru (example)
- **Configurable**: Any coastal city via `city.yaml`

### Time Scales
- **Forecast**: 24 hours
- **Resolution**: 1 hour
- **Flash flood**: 10cm street water threshold
- **Road closure**: 30cm threshold

### Uncertainty
- **Probability**: Isotonic regression calibration
- **Depth intervals**: Split-conformal (~80% coverage)
- **Timing windows**: P10–P90 ranges
- **Stability**: Rank stability across ensemble members

## Implementation Priority (Solo)

**Hours 0-24**: F1→F2→F3→F4→F8→F9→F15→F16→F17→F10→F11→F12→F13→F14→F7→F6

**Critical Gates**:
- **Hour 6**: One scenario produces believable depth map
- **Hour 12**: Flood Map with time slider works
- **Hour 19**: Street check with household advisor
- **Hour 23**: Full offline demo working

## Validation

### Training Labels
- Generated by Poseidon-Sim
- Simulated data (not real floods)
- Event-heldout and spatial-block splits

### Safety Requirements
- Household advisor conservative
- "Safe to wait" only with low probability
- "Leave by" before route closure
- Never advise walking through water

### Metrics
- ROC-AUC > 0.7 (event-heldout)
- MAE < 1 hour (timing)
- MAE < 0.1m (depth)
- Conservative error rates < 5%

## Files to Focus On

### First 48 Hours
1. **src/ingest/weather.py** - Weather data loading
2. **src/ingest/marine.py** - Tide/surge data
3. **src/terrain/features.py** - DEM processing
4. **src/ingest/osm.py** - Infrastructure extraction
5. **src/sim/poseidon_sim.py** - Flood simulation
6. **src/model/train.py** - ML training
7. **src/impact/buildings.py** - Building exposure
8. **src/impact/roads.py** - Road closure
9. **src/decision/advisor.py** - Household advisor

### Integration Critical
1. **app/streamlit_app.py** - Main dashboard
2. **src/impact/access.py** - Time-to-safety
3. **src/decision/route.py** - Safe routes
4. **src/decision/safe_zone.py** - Shelter finder

## Getting Help

### Documentation
- **Architecture**: `docs/architecture.md`
- **Implementation Plan**: `docs/implementation_plan.md`
- **Technical Details**: `docs/technical.md`

### Troubleshooting

#### Import Errors
```bash
# Install missing packages
pip install package_name

# Check virtual environment
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate    # Windows
```

#### Data Issues
```bash
# Regenerate data if corrupted
rm -rf data/cache/*
rm -rf data/processed/*
python src/ingest/__main__.py
```

#### Performance Issues
```bash
# Check memory usage
free -h

# Check disk space
df -h

# Clear temp files
rm -rf /tmp/*.parquet
```

## Project Status

### Current Phase
**Phase 1**: Setup environment, install dependencies, create structure

### Next Phase  
**Phase 2**: Data preprocessing (DEM, OSM, H3 zones)

### Gates to Hit
1. **Environment setup**: All imports work
2. **Data loading**: DEM and OSM load successfully  
3. **First scenario**: Believable depth map
4. **Full demo**: Runs offline from cache

## Development Workflow

### Iteration Pattern
1. **Test**: Verify component works in isolation
2. **Integrate**: Add to full pipeline
3. **Validate**: Check against requirements
4. **Document**: Update usage examples

### Code Style
- Black formatting
- Type hints where possible
- Unit tests for critical functions
- Clear docstrings

## Future Extensions

### Phase 2 (After MVP)
- Live weather API integration
- Multiple study areas
- Advanced calibration methods
- LLM-powered explanations

### Phase 3 (Post-hackathon)
- Sentinel-1 validation
- Real municipal data
- SMS/WhatsApp alerts
- Multi-city deployment

## Contributing

### Development Setup
```bash
# Fork and clone
# Create feature branch
# Make changes
# Test thoroughly
# Create pull request
```

### Testing
```bash
# Run unit tests
pytest tests/

# Run integration tests
pytest tests/integration/

# Format code
black src/

# Type checking
mypy src/
```

## License

MIT License

## Acknowledgments

This project is part of Singularity 2026 Track 1 (Coastal Flood Intelligence)

---

**Poseidon** - Know before the water arrives

*Build carefully. Validate often. Be conservative.*