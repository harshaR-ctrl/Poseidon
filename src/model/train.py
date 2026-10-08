import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
import os
import logging
from sklearn.metrics import roc_auc_score, mean_absolute_error

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def train_models(labels_path="data/cache/replay/scenario_labels.parquet",
                 features_path="data/cache/replay/scenario_timeseries.parquet",
                 terrain_path="data/processed/terrain_features.parquet",
                 output_dir="data/models"):
    """
    Trains the five XGBoost heads (F3).
    """
    os.makedirs(output_dir, exist_ok=True)
    
    logger.info("Loading training data...")
    if not os.path.exists(labels_path):
        logger.error(f"Missing labels at {labels_path}. Run PoseidonSim first.")
        return
        
    df_labels = pd.read_parquet(labels_path)
    df_ts = pd.read_parquet(features_path)
    df_terrain = pd.read_parquet(terrain_path)
    
    # Feature engineering for training
    event_features = []
    for evt, group in df_ts.groupby('event_id'):
        zone_group = group[group['zone_id'] == group['zone_id'].iloc[0]] 
        rain_sum = zone_group['rain_mm'].sum()
        rain_max = zone_group['rain_mm'].max()
        tide_max = zone_group['tide_m'].max()
        
        event_features.append({
            'event_id': evt,
            'rain_24h': rain_sum,
            'rain_peak_intensity': rain_max,
            'tide_max': tide_max
        })
        
    df_evts = pd.DataFrame(event_features)
    df = df_labels.merge(df_evts, on='event_id')
    df = df.merge(df_terrain, on='zone_id')
    
    feature_cols = [
        'rain_24h', 'rain_peak_intensity', 'tide_max',
        'elevation_mean', 'slope_mean', 'sink_depth', 
        'distance_to_coast', 'imperviousness', 'drainage_proxy'
    ]
    
    X = df[feature_cols]
    
    # Split train/test based on event_id to prevent leakage
    events = df['event_id'].unique()
    np.random.shuffle(events)
    train_evts = events[:int(len(events)*0.8)]
    
    train_mask = df['event_id'].isin(train_evts)
    test_mask = ~train_mask
    
    X_train, X_test = X[train_mask], X[test_mask]
    
    logger.info("Training Model 1: Flood Probability (XGBClassifier)")
    y_prob = df['p_flood']
    clf = xgb.XGBClassifier(n_estimators=100, random_state=42, use_label_encoder=False, eval_metric='logloss')
    clf.fit(X_train, y_prob[train_mask])
    probs = clf.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_prob[test_mask], probs)
    logger.info(f"Flood Prob ROC-AUC: {auc:.3f}")
    joblib.dump(clf, os.path.join(output_dir, "prob_model.joblib"))
    
    logger.info("Training Model 2: Peak Depth (Quantiles via XGBoost)")
    y_depth = df['max_depth']
    depth_models = {}
    for alpha in [0.1, 0.5, 0.9]:
        # XGBoost >= 2.0 supports quantile regression directly
        reg = xgb.XGBRegressor(objective='reg:quantileerror', quantile_alpha=alpha, n_estimators=100)
        reg.fit(X_train, y_depth[train_mask])
        depth_models[f'p{int(alpha*100)}'] = reg
    joblib.dump(depth_models, os.path.join(output_dir, "depth_models.joblib"))
    
    logger.info("Training Model 3 & 4: Onset@10cm and Onset@30cm")
    flood_mask = df['p_flood'] == 1
    train_flood = train_mask & flood_mask
    test_flood = test_mask & flood_mask
    
    onset_10_reg = xgb.XGBRegressor(n_estimators=100, objective='reg:squarederror')
    onset_10_reg.fit(X[train_flood], df.loc[train_flood, 'onset_10cm'])
    mae_10 = mean_absolute_error(df.loc[test_flood, 'onset_10cm'], onset_10_reg.predict(X[test_flood]))
    logger.info(f"Onset@10cm MAE: {mae_10:.2f} hours")
    joblib.dump(onset_10_reg, os.path.join(output_dir, "onset_10_model.joblib"))
    
    flood_30_mask = df['onset_30cm'] >= 0
    train_flood_30 = train_mask & flood_30_mask
    test_flood_30 = test_mask & flood_30_mask
    
    onset_30_reg = xgb.XGBRegressor(n_estimators=100, objective='reg:squarederror')
    if train_flood_30.sum() > 0:
        onset_30_reg.fit(X[train_flood_30], df.loc[train_flood_30, 'onset_30cm'])
        mae_30 = mean_absolute_error(df.loc[test_flood_30, 'onset_30cm'], onset_30_reg.predict(X[test_flood_30]))
        logger.info(f"Onset@30cm MAE: {mae_30:.2f} hours")
    joblib.dump(onset_30_reg, os.path.join(output_dir, "onset_30_model.joblib"))
    
    logger.info("Training Model 5: Peak Time")
    peak_reg = xgb.XGBRegressor(n_estimators=100, objective='reg:squarederror')
    peak_reg.fit(X[train_flood], df.loc[train_flood, 'peak_hour'])
    mae_peak = mean_absolute_error(df.loc[test_flood, 'peak_hour'], peak_reg.predict(X[test_flood]))
    logger.info(f"Peak Time MAE: {mae_peak:.2f} hours")
    joblib.dump(peak_reg, os.path.join(output_dir, "peak_time_model.joblib"))
    
    logger.info("All XGBoost models trained and saved successfully.")

if __name__ == "__main__":
    train_models()
