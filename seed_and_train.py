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
    logger.info("--- STEP 1: Generating 12 H3 Zones and Terrain Features ---")
    bbox = (12.80, 74.79, 12.98, 74.89)  # Adjusted bbox for Mangaluru coast
    zones = features.generate_h3_zones(bbox, resolution=9)[:12]  # Limit to 12 zones for demo
    features.build_terrain_features(zones)
    
    # 2. Simulate 50 Historical Events (F2)
    logger.info("--- STEP 2: Running Poseidon-Sim to generate synthetic historical flood data ---")
    # Reduced to 50 events for a quick demo setup
    poseidon_sim.generate_scenarios(n_scenarios=50)
    
    # 3. Train the XGBoost Models (F3)
    logger.info("--- STEP 3: Training XGBoost Prediction Models ---")
    train.train_models()
    
    logger.info("✅ SUCCESS: Data generated and models trained successfully.")
    logger.info("You can now launch the dashboard by running: streamlit run app/streamlit_app.py")

if __name__ == "__main__":
    run_seed_and_train()
