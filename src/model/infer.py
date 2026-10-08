import pandas as pd
import numpy as np
import joblib
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import xgboost as xgb

def run_inference(scenario_features, model_dir="data/models"):
    """
    Runs the five XGBoost heads on incoming scenarios to generate predictions (F6, F7).
    """
    logger.info("Loading models for inference...")
    
    try:
        clf = joblib.load(os.path.join(model_dir, "prob_model.joblib"))
        depth_models = joblib.load(os.path.join(model_dir, "depth_models.joblib"))
        onset_10 = joblib.load(os.path.join(model_dir, "onset_10_model.joblib"))
        onset_30 = joblib.load(os.path.join(model_dir, "onset_30_model.joblib"))
        peak_time = joblib.load(os.path.join(model_dir, "peak_time_model.joblib"))
    except FileNotFoundError:
        logger.error("Models not found. Ensure train.py has been run.")
        return None
        
    X = scenario_features
    
    logger.info("Running predictions...")
    
    predictions = pd.DataFrame({'zone_id': X.get('zone_id', np.arange(len(X)))})
    
    # Feature matrix expected by models (dropping non-feature columns)
    feature_cols = [
        'rain_24h', 'rain_peak_intensity', 'tide_max',
        'elevation_mean', 'slope_mean', 'sink_depth', 
        'distance_to_coast', 'imperviousness', 'drainage_proxy'
    ]
    
    # Fill missing columns with dummy data if not provided
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0.0
            
    X_model = X[feature_cols]
    
    # 1. Probability
    predictions['p_flood'] = clf.predict_proba(X_model)[:, 1]
    
    # 2. Peak Depth Quantiles
    predictions['peak_depth_p10'] = depth_models['p10'].predict(X_model)
    predictions['peak_depth_p50'] = depth_models['p50'].predict(X_model)
    predictions['peak_depth_p90'] = depth_models['p90'].predict(X_model)
    
    # Ensure depth is >= 0
    predictions['peak_depth_p10'] = np.clip(predictions['peak_depth_p10'], 0, None)
    predictions['peak_depth_p50'] = np.clip(predictions['peak_depth_p50'], 0, None)
    predictions['peak_depth_p90'] = np.clip(predictions['peak_depth_p90'], 0, None)
    
    # 3. Onset & Peak Times
    predictions['onset_10cm_hr'] = np.clip(onset_10.predict(X_model), 0, 24)
    predictions['onset_30cm_hr'] = np.clip(onset_30.predict(X_model), 0, 24)
    predictions['peak_time_hr'] = np.clip(peak_time.predict(X_model), 0, 24)
    
    # Severity classification
    def get_severity(depth):
        if depth < 0.10: return "None"
        elif depth < 0.30: return "Minor"
        elif depth < 0.60: return "Moderate"
        elif depth < 1.00: return "Severe"
        else: return "Extreme"
        
    predictions['severity_class'] = predictions['peak_depth_p50'].apply(get_severity)
    
    logger.info("Inference complete.")
    return predictions

if __name__ == "__main__":
    # Test with dummy data
    df = pd.DataFrame({
        'zone_id': ['zone_1', 'zone_2'],
        'rain_24h': [100.0, 20.0],
        'rain_peak_intensity': [30.0, 5.0],
        'tide_max': [1.5, 0.8],
        'elevation_mean': [1.0, 5.0],
        'slope_mean': [1.0, 2.0],
        'sink_depth': [0.5, 0.0],
        'distance_to_coast': [0.5, 5.0],
        'imperviousness': [0.8, 0.2],
        'drainage_proxy': [0.4, 0.8]
    })
    
    preds = run_inference(df)
    if preds is not None:
        print(preds)
