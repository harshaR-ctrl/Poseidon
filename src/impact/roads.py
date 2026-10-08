import pandas as pd
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def assess_road_impact(roads_df, predictions_df, closure_threshold_m=0.30):
    """
    Assesses road closures based on flood depth (F10).
    Roads are impassable at 30cm depth.
    """
    logger.info("Assessing road closures...")
    
    # Merge roads with zone predictions
    impact = roads_df.merge(predictions_df[['zone_id', 'peak_depth_p50', 'onset_30cm_hr']], on='zone_id', how='left')
    
    # A road is closed if depth > closure threshold (default 30cm)
    impact['is_closed'] = impact['peak_depth_p50'] > closure_threshold_m
    
    # Estimate time road is closed
    impact['closure_hr'] = np.where(impact['is_closed'], impact['onset_30cm_hr'], -1)
    
    # Aggregate by zone
    zone_impact = impact.groupby('zone_id').agg(
        total_roads=('road_id', 'count'),
        closed_roads=('is_closed', 'sum')
    ).reset_index()
    
    return impact, zone_impact

if __name__ == "__main__":
    r_df = pd.DataFrame({'road_id': [101, 102], 'zone_id': ['z1', 'z1']})
    p_df = pd.DataFrame({'zone_id': ['z1'], 'peak_depth_p50': [0.4], 'onset_30cm_hr': [14.0]})
    impact, summary = assess_road_impact(r_df, p_df)
    print(summary)
