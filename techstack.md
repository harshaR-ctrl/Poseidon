# Poseidon — Tech Stack

> Track 1 · AI for Coastal Flood Intelligence · Singularity 2026
> Built around the brief's story: *a rainy afternoon, a rising tide, struggling drains, and a family on the ground floor deciding whether to leave now or wait.*
> Design rule: **everything runs on one laptop, CPU only, with no paid API and no cloud dependency at demo time.**

---

## 1. Feasibility verdict

**Yes, this is buildable in 24 hours on a laptop.** I benchmarked the heavy parts on a deliberately weak machine (1 vCPU, 3 GB RAM, no GPU). Your laptop will be faster.

| Workload | What I tested | Result (1 vCPU / 3 GB) |
|---|---|---|
| Flood simulator | 300 scenarios × 48 h × 71,000 cells (8×8 km at 30 m) | **23.8 s total** (~0.08 s per scenario) |
| Surrogate training | LightGBM, 600,000 rows × 28 features | **~16–23 s per model** |
| Ensemble inference | 30 ensemble members × 1,000 zones (30,000 rows) | **0.22 s** |
| SHAP explanations | 50 zones | **0.9 s** |
| Road-access analysis | 50k-node / 200k-edge graph, 12 time steps | **13 s** (so ~1 min for the 48 half-hour steps behind the household "leave by" advisor) |

**Caveats on these numbers (so you plan honestly):**
- The simulator benchmark did *not* include lateral water redistribution. Budget about 5× more (≈0.4 s per scenario, so ~1,000 scenarios in under 10 minutes). Still fine.
- The road graph was synthetic. A real OSM drive network for a ≤10×10 km area is the same order of magnitude. Do not download a whole district or state.
- Recommended laptop: 8 GB RAM, 4 cores, 5 GB free disk. No GPU needed. Nothing in this stack uses one.

---

## 2. Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Language | **Python 3.11** | One language end to end, so no glue code to debug at 3 AM |
| Raster / terrain | `rasterio`, `numpy`, `scipy.ndimage`, `scikit-image`; optional `pysheds` | Slope, sink depth, flow accumulation, HAND |
| Vector / geo | `geopandas`, `shapely`, `pyproj`, **`h3`** | H3 hexagons give uniform neighbourhood-scale zones |
| Road network | `osmnx` + `networkx` | OSM roads, buildings and facilities with one call; graph routing built in. Street names in the graph power offline street search |
| Household advisor | Plain Python on top of `networkx` + the model outputs | Time-to-safety field per departure step, then an instant lookup per street |
| Flood generator | **Poseidon-Sim** (own code, `numpy`) | Fast reduced-complexity simulator that makes training scenarios (see `project_description.md`) |
| ML | **`lightgbm`**, `scikit-learn` | Fast on CPU, handles tabular features, supports quantile loss, works natively with SHAP |
| Calibration | `scikit-learn` isotonic regression + **hand-written split-conformal** (about 15 lines) | Calibrated probabilities and depth intervals with no extra dependency |
| Explainability | **`shap`** (`TreeExplainer`) + a template-based phrase library | Ranked drivers translated into plain language |
| Forecast ingest | `requests` against **Open-Meteo** (Forecast, Ensemble, Marine APIs) | Free, no API key; ensemble members give uncertainty windows |
| Dashboard | **Streamlit** + **pydeck** (deck.gl) + `plotly` | Fastest path to a live map. pydeck has a native `H3HexagonLayer`. |
| Storage | Parquet files (`pyarrow`) + `joblib` for models | No database to run |
| Optional GenAI | **Ollama** with a small local model (e.g. a 3B-class instruct model) | Grounded briefing, fully offline. A template fallback means the demo never depends on it. |
| Templating | `jinja2` | Deterministic alert text and Kannada/English templates |

### Not in the stack, on purpose
- **No GPU deep learning** (no CNN/LSTM/Transformer training). Gradient boosting on engineered features is faster to build, easier to explain, and enough for this brief.
- **No full hydrodynamic solver** (HEC-RAS, LISFLOOD, MIKE+). Too heavy and too slow to set up in 24 hours.
- **No database, Docker, or cloud deploy.** One `streamlit run` command is the whole deployment.
- **No React front end** unless you finish early. Streamlit is enough for the 10-point dashboard criterion.

---

## 3. Data sources (all free)

| Data | Source | Used for | Notes |
|---|---|---|---|
| Elevation | **Copernicus DEM GLO-30** (30 m) | Elevation, slope, sinks, HAND | It is a *surface* model (includes buildings and trees). Smooth it slightly and say so in your limitations. |
| Roads, buildings, hospitals, shelters, schools, fire/police, waterways, land use | **OpenStreetMap** via `osmnx` | Impact layer, routing, drainage proxy | Attribute OSM (ODbL) in the dashboard footer |
| Land cover | **ESA WorldCover** (10 m), or OSM `landuse` as fallback | Imperviousness, curve number | WorldCover needs a tile download. OSM is the zero-download fallback. |
| Population (optional) | **WorldPop** 100 m raster | Exposure weighting | If skipped, use building count × an assumed household size and label it an assumption |
| Rain forecast + ensemble | **Open-Meteo** Forecast and Ensemble APIs | Live mode | Free tier is for non-commercial use. Fine for a hackathon. |
| Sea level / tide / waves | **Open-Meteo Marine API** | Live mode | **Verify the exact variable names on your first call.** Fallback: harmonic tide (M2, S2, K1, O1) in your own code. |
| Historical rain (optional) | Open-Meteo Historical API | Realistic storm shapes and antecedent rain | Use it to calibrate scenario generator ranges |

**Offline-first rule:** download everything once, save to `data/cache/`, and make the demo run from cache. Live mode is a toggle, not a dependency. Venue Wi-Fi is the most likely thing to fail on demo day.

---

## 4. Repo layout

```
poseidon/
├── config/
│   └── city.yaml              # bbox, thresholds, plinth height, buffers, weights, API toggles (swap city = edit this)
├── data/
│   ├── raw/                   # DEM tile, OSM extracts
│   ├── processed/             # zones.parquet, terrain_features.parquet, graph.graphml
│   └── cache/                 # saved API responses for offline demo
├── src/
│   ├── ingest/                # dem.py, osm.py, weather.py
│   ├── terrain/               # features.py  (slope, sink depth, HAND, distance-to-coast)
│   ├── sim/                   # poseidon_sim.py, scenarios.py
│   ├── model/                 # train.py, calibrate.py, infer.py, explain.py
│   ├── impact/                # exposure.py, roads.py, access.py (time-to-safety), advisor.py, priority.py, dispatch.py
│   └── narrate/               # alerts.py, briefing.py, templates/
├── app/
│   └── streamlit_app.py
├── notebooks/
│   └── validation.ipynb       # metrics, reliability diagram, stress tests
├── tests/                     # a few sanity tests (units, no leakage, threshold logic)
├── requirements.txt
└── README.md
```

---

## 5. Setup

```bash
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install numpy pandas scipy scikit-image rasterio geopandas shapely pyproj h3 \
            osmnx networkx lightgbm scikit-learn shap pyarrow joblib requests \
            streamlit pydeck plotly jinja2 pyyaml
# optional
pip install pysheds
# optional local LLM: install Ollama, then pull a small instruct model
```

**Windows tip:** `rasterio`, `geopandas` and `shapely` install most reliably as wheels on Python 3.11. If a build fails, use `conda install -c conda-forge geopandas rasterio osmnx` instead of fighting `pip`.

---

## 6. Performance budget (keep to this)

| Item | Budget |
|---|---|
| Study area | ≤ 10 × 10 km, grid at 30 m (≈110k cells max) |
| Zones | ~600–1,200 H3 hexagons at resolution 9 |
| Training scenarios | 800–1,500 |
| Forecast horizon | 24 h at hourly steps |
| Ensemble members | 30–50 |
| Road graph | ≤ 60k nodes (simplify, drive network only) |
| Time-to-safety field | 48 half-hour departure steps, recomputed only when the forecast refreshes. Household and street lookups read the saved result. |
| Dashboard refresh | All map layers read pre-computed Parquet. Only the what-if slider triggers live model inference (<1 s). |

---

## 7. Demo-day resilience

- Cache every API response. Demo runs from cache by default.
- Pre-compute the "storyline" scenario (full outputs, including the time-to-safety field) so the dashboard and the household advisor load instantly.
- Record a 90-second screen capture as a backup.
- Basemap tiles need internet. Make sure the map is still readable without them (hexes, roads and facility icons on a dark background).
- Pin your dependencies (`pip freeze > requirements.txt`) before the final hour. Do not upgrade anything after that.

---

## 8. Licences and attribution to show in the app footer

OpenStreetMap contributors (ODbL) · Copernicus DEM · ESA WorldCover (CC BY 4.0) · WorldPop (CC BY 4.0) · Open-Meteo (CC BY 4.0).
