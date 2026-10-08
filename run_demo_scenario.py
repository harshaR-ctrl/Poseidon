import logging
import pandas as pd
import numpy as np
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from src.model.infer import run_inference
from src.impact.buildings import assess_building_impact
from src.impact.roads import assess_road_impact
from src.decision.advisor import generate_household_verdict
from src.model.explain import generate_plain_language_drivers

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def run_demo_scenario():
    logger.info("=== POSEIDON: INCOMING STORM DEMO ===")
    
    # 1. Incoming Storm Data
    logger.info("1. Receiving live weather and marine forecast for 'Surathkal' zone...")
    incoming_storm = pd.DataFrame({
        'zone_id': ['89618c1abc'],
        'rain_24h': [250.0],           # Extreme rain
        'rain_peak_intensity': [65.0],
        'tide_max': [2.8],             # Extreme tide
        'elevation_mean': [0.5],       
        'slope_mean': [1.2],
        'sink_depth': [0.1],
        'distance_to_coast': [0.5],
        'imperviousness': [0.8],       
        'drainage_proxy': [0.3]        
    })
    
    # 2. Model Inference (Predicting the Flood)
    logger.info("\n2. Pushing data through the trained XGBoost models...")
    predictions = run_inference(incoming_storm)
    
    if predictions is None:
        logger.error("Could not run inference. Did you run seed_and_train.py first?")
        return
        
    p_row = predictions.iloc[0]
    logger.info(f"   -> Probability of Flooding: {p_row['p_flood']:.1%}")
    logger.info(f"   -> Peak Depth (Severity): {p_row['peak_depth_p50']:.2f}m ({p_row['severity_class']})")
    logger.info(f"   -> Water Reaches Street at: Hour {p_row['onset_10cm_hr']:.1f}")
    
    # 3. Generating Explanations
    logger.info("\n3. Translating prediction drivers into plain language (SHAP proxy)...")
    drivers = generate_plain_language_drivers(incoming_storm.iloc[0].to_dict())
    logger.info(f"   -> {drivers}")
    
    # 4. Impact Analysis
    logger.info("\n4. Overlaying predictions on infrastructure (Roads & Buildings)...")
    b_df = pd.DataFrame({'building_id': [1], 'zone_id': ['89618c1abc'], 'plinth_height': [0.30]})
    r_df = pd.DataFrame({'road_id': [1], 'zone_id': ['89618c1abc']})
    
    _, b_impact = assess_building_impact(b_df, predictions)
    _, r_impact = assess_road_impact(r_df, predictions)
    
    flooded_bldgs = b_impact['flooded_buildings'].iloc[0]
    closed_roads = r_impact['closed_roads'].iloc[0]
    logger.info(f"   -> Exposed Buildings: {flooded_bldgs}")
    logger.info(f"   -> Impassable Roads: {closed_roads}")
    
    # 5. Decision Support
    logger.info("\n5. Generating Household Leave-Now Advisor Verdict...")
    # Mock row extracts for the advisor
    b_mock = {'is_flooded': flooded_bldgs > 0}
    r_mock = {'is_closed': closed_roads > 0, 'closure_hr': p_row['onset_30cm_hr']}
    
    verdict = generate_household_verdict(p_row, r_mock, b_mock, needs_assistance=True)
    logger.info(f"   -> VERDICT: {verdict['verdict']}")
    logger.info(f"   -> RATIONALE: {verdict['message']}")
    
    logger.info("\n=== DEMO COMPLETE ===")

if __name__ == "__main__":
    run_demo_scenario()
