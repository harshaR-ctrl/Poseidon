#!/usr/bin/env python3
"""
Poseidon setup and environment validation script.
Run this to verify the development environment is properly configured.
"""

import os
import sys
import platform
import subprocess
import importlib.util
from pathlib import Path

# Configuration
REQUIRED_PYTHON = "3.9"
REQUIRED_PACKAGES = [
    "numpy",
    "pandas",
    "lightgbm",
    "streamlit",
    "pydeck",
    "h3-py",
    "matplotlib",
    "seaborn",
    "scikit-learn",
    "joblib",
    "geopandas",
    "pyyaml",
    "tqdm",
]

def check_python_version():
    """Check if Python version meets requirements."""
    print(f"Python version: {platform.python_version()}")

    current = tuple(map(int, platform.python_version().split('.')[:2]))
    required = tuple(map(int, REQUIRED_PYTHON.split('.')))

    if current < required:
        print(f"[FAIL] Python {REQUIRED_PYTHON}+ required, found {platform.python_version()}")
        return False

    print(f"[OK] Python version {platform.python_version()} meets requirements")
    return True

def check_packages():
    """Check if all required packages are installed."""
    print("\nChecking required packages...")
    missing = []

    for package in REQUIRED_PACKAGES:
        try:
            importlib.import_module(package.replace('-', '_'))
            print(f"  [OK] {package}")
        except ImportError:
            print(f"  [FAIL] {package} - NOT INSTALLED")
            missing.append(package)

    if missing:
        print(f"\n[FAIL] Missing packages: {', '.join(missing)}")
        print("Run: pip install -r requirements.txt")
        return False

    print("\n[OK] All required packages installed")
    return True

def check_environment():
    """Check system environment compatibility."""
    print("\nChecking environment...")

    # Check Python environment
    print(f"Platform: {platform.system()}")
    print(f"Architecture: {platform.machine()}")

    # Check if we're in the right directory
    current_dir = os.getcwd()
    if "poseidon" not in current_dir.lower():
        print(f"[WARN] Warning: Not in Poseidon directory ({current_dir})")

    # Check for essential files
    essential_files = [
        "requirements.txt",
        "config/city.yaml",
        "README.md",
        "CLAUDE.md",
    ]

    print("\nChecking essential files:")
    all_exist = True
    for file_path in essential_files:
        full_path = Path(file_path)
        if full_path.exists():
            print(f"  [OK] {file_path}")
        else:
            print(f"  [FAIL] {file_path} - MISSING")
            all_exist = False

    if not all_exist:
        print("\n[WARN] Warning: Some essential files missing")

    return all_exist

def check_data_files():
    """Check if essential data directories exist."""
    print("\nChecking data directories...")

    data_dirs = [
        "data/raw",
        "data/processed",
        "data/cache",
    ]

    all_exist = True
    for dir_path in data_dirs:
        if Path(dir_path).exists():
            print(f"  [OK] {dir_path}/")
        else:
            print(f"  [WARN] {dir_path}/ - WILL CREATE")
            try:
                os.makedirs(dir_path, exist_ok=True)
                print(f"  [OK] Created {dir_path}/")
            except Exception as e:
                print(f"  [FAIL] Failed to create {dir_path}/: {e}")
                all_exist = False

    return all_exist

def check_source_structure():
    """Check if source code structure is correct."""
    print("\nChecking source structure...")

    required_modules = [
        "src/ingest",
        "src/terrian",  # Note: kept for compatibility with existing references
        "src/sim",
        "src/model",
        "src/impact",
        "src/decision",
        "src/narrative",
    ]

    all_exist = True
    for module in required_modules:
        if Path(module).exists():
            print(f"  [OK] {module}/")
        else:
            print(f"  [FAIL] {module}/ - MISSING")
            all_exist = False

    # Check key source files
    key_files = [
        "src/sim/poseidon_sim.py",
        "src/model/train.py",
        "src/decision/advisor.py",
        "app/streamlit_app.py",
    ]

    print("\nChecking key source files:")
    for file_path in key_files:
        full_path = Path(file_path)
        if full_path.exists():
            print(f"  [OK] {file_path}")
        else:
            print(f"  [WARN] {file_path} - WILL CREATE PLACEHOLDER")

    return all_exist

def create_initial_files():
    """Create initial placeholder files if missing."""
    print("\nCreating initial placeholder files...")

    # Create __init__.py files for Python modules
    for module in ["src/ingest", "src/terrian", "src/sim", "src/model",
                   "src/impact", "src/decision", "src/narrative", "app",
                   "notebooks", "tests"]:
        init_file = Path(f"{module}/__init__.py")
        if not init_file.exists():
            init_file.write_text('"""Module initialization."""\n')
            print(f"  [OK] Created {init_file}")

    # Create main source files with basic structure
    source_files = [
        ("src/ingest/weather.py", '''"""Weather data ingestion."""
import pandas as pd

class WeatherIngestion:
    """Handles weather data loading and preprocessing."""

    def __init__(self, data_path="data/raw/weather/"):
        self.data_path = data_path

    def load_forecast(self):
        """Load weather forecast data."""
        # TODO: Implement actual data loading
        return pd.DataFrame()

    def preprocess(self, data):
        """Preprocess weather data."""
        return data
'''),

        ("src/ingest/marine.py", '''"""Marine/tide data ingestion."""
import pandas as pd

class MarineIngestion:
    """Handles tide and surge data loading."""

    def __init__(self, data_path="data/raw/marine/"):
        self.data_path = data_path

    def load_tide_data(self):
        """Load tide and surge data."""
        return pd.DataFrame()
'''),

        ("src/terrian/features.py", '''"""Terrain feature extraction from DEM."""
import numpy as np
import geopandas as gpd

class TerrainFeatures:
    """Extracts terrain features from Digital Elevation Model."""

    def __init__(self, dem_path="data/raw/dem/"):
        self.dem_path = dem_path

    def extract_features(self):
        """Extract terrain features (elevation, slope, etc.)."""
        # TODO: Implement actual feature extraction
        return {}
'''),

        ("src/sim/poseidon_sim.py", '''"""Poseidon-Sim: Reduced-physics flood simulator."""
import numpy as np
import pandas as pd

class PoseidonSim:
    """Fast reduced-complexity simulator for flood scenarios."""

    def __init__(self, config=None):
        self.config = config or {}

    def generate_scenario(self):
        """Generate one flood scenario."""
        # TODO: Implement simulation logic
        return {
            'zone_id': 'test_zone',
            'depth_time_series': np.array([0.0, 0.1, 0.2, 0.3]),
            'labels': {'P(flood)': 0.8, 'peak_depth': 0.3}
        }

    def tide_blocked_drainage(self, capacity, tide, outfall_level):
        """Calculate drainage capacity reduced by tide."""
        # Core coastal mechanism from Poseidon-Sim
        blocking_factor = 1 - (1 / (1 + np.exp(-5 * (tide - outfall_level))))
        return capacity * (1 - blocking_factor)
'''),

        ("src/decision/advisor.py", '''"""Household decision advisor."""
import pandas as pd

class HouseholdAdvisor:
    """Provides conservative household decisions for flood safety."""

    def __init__(self, plinth_height=0.30):
        self.plinth_height = plinth_height

    def evaluate_situation(self, predictions, accessibility, location):
        """Evaluate household situation and provide advice."""
        # TODO: Implement decision logic
        return {
            'verdict': 'CHECK_REQUIRED',
            'confidence': 0.5,
            'reasoning': 'Needs full implementation'
        }
'''),

        ("app/streamlit_app.py", '''"""Poseidon Streamlit dashboard application."""
import streamlit as st
import pandas as pd

# Set page configuration
st.set_page_config(
    page_title="Poseidon - Coastal Flood Intelligence",
    page_icon="🌊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

def main():
    """Main application function."""
    st.title("🌊 Poseidon - Coastal Flood Intelligence")
    st.markdown("Know before the water arrives")

    # TODO: Implement full dashboard
    st.info("Poseidon application - Setup complete. Ready for implementation.")

    # Basic layout structure
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Flood Map")
        st.markdown("Interactive flood extent map with time slider")

    with col2:
        st.subheader("Severity Heatmap")
        st.markdown("Flood severity/depth intensity visualization")

if __name__ == "__main__":
    main()
'''),
    ]

    for file_path, content in source_files:
        full_path = Path(file_path)
        if not full_path.exists():
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content)
            print(f"  ✅ Created {file_path}")

def main():
    """Main setup function."""
    print("=" * 60)
    print("POSEIDON DEVELOPMENT ENVIRONMENT SETUP")
    print("=" * 60)

    checks = [
        ("Python Version", check_python_version),
        ("Packages", check_packages),
        ("Environment", check_environment),
        ("Data Directories", check_data_files),
        ("Source Structure", check_source_structure),
    ]

    results = []
    for check_name, check_func in checks:
        print(f"\n{'='*60}")
        print(f"CHECK: {check_name}")
        print('=' * 60)
        try:
            result = check_func()
            results.append((check_name, result))
        except Exception as e:
            print(f"❌ Error in {check_name}: {e}")
            results.append((check_name, False))

    # Summary
    print(f"\n{'='*60}")
    print("SETUP SUMMARY")
    print('=' * 60)

    all_passed = True
    for check_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {check_name}")
        if not result:
            all_passed = False

    # Create initial files if any checks failed
    if not all_passed:
        print(f"\n{'='*60}")
        print("CREATING INITIAL PLACEHOLDER FILES")
        print('=' * 60)
        create_initial_files()

    # Final message
    print(f"\n{'='*60}")
    if all_passed:
        print("✅ SETUP COMPLETE - Environment ready for development!")
        print("\nNext steps:")
        print("1. Run: streamlit run app/streamlit_app.py")
        print("2. Implement core modules step by step")
        print("3. Follow the implementation plan in POSEIDON_IMPLEMENTATION_PLAN.md")
    else:
        print("⚠️  SETUP ISSUES DETECTED")
        print("Please fix the failed checks before proceeding.")
        print("\nRun: python setup.py --fix")

    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

# Additional commands
if __name__ == "__main__" and len(sys.argv) > 1:
    if sys.argv[1] == "--fix":
        print("Run: pip install -r requirements.txt")
        print("Then run: python setup.py again")
        sys.exit(0)