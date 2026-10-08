import logging
import os
import sys

# Ensure src is in the python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.terrain import features
from src.sim import poseidon_sim
from src.model import train

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_seed_and_train():
    logger.info("Starting End-to-End Seed and Train Process...")
    
    # 1. Generate Zones and Synthetic Terrain (F1)
    logger.info("--- STEP 1: Generating Exact UI Zones and Terrain Features ---")
    zones = features.generate_h3_zones()
    features.build_terrain_features(zones)
    
    # 2. Simulate 500 Historical Events (F2)
    logger.info("--- STEP 2: Running Poseidon-Sim to generate synthetic historical flood data ---")
    # Increased to 500 events for realistic model accuracy and proper RPI/Alerts
    poseidon_sim.generate_scenarios(n_scenarios=500)
    
    # 3. Train the XGBoost Models (F3)
    logger.info("--- STEP 3: Training XGBoost Prediction Models ---")
    train.train_models()
    
    logger.info("✅ SUCCESS: Data generated and models trained successfully.")
    logger.info("You can now launch the dashboard by running: streamlit run app/streamlit_app.py")

if __name__ == "__main__":
    run_seed_and_train()
