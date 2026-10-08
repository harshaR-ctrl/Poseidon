import pandas as pd
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def assess_building_impact(buildings_df, predictions_df, plinth_height_default=0.30):
    """
    Assesses impact on buildings by comparing predicted depth against plinth height (F10, F12).
    """
    logger.info("Assessing building impact...")
    
    # Merge buildings with zone predictions
    # Assuming buildings_df has 'zone_id', 'building_id', 'plinth_height'
    if 'plinth_height' not in buildings_df.columns:
        buildings_df['plinth_height'] = plinth_height_default
        
    impact = buildings_df.merge(predictions_df[['zone_id', 'peak_depth_p50', 'onset_30cm_hr']], on='zone_id', how='left')
    
    # A building is exposed if depth > plinth height
    impact['is_flooded'] = impact['peak_depth_p50'] > impact['plinth_height']
    
    # Estimate time ground floor floods
    impact['ground_floor_flood_hr'] = np.where(impact['is_flooded'], impact['onset_30cm_hr'], -1)
    
    # Aggregate by zone
    zone_impact = impact.groupby('zone_id').agg(
        total_buildings=('building_id', 'count'),
        flooded_buildings=('is_flooded', 'sum')
    ).reset_index()
    
    zone_impact['flooded_pct'] = (zone_impact['flooded_buildings'] / zone_impact['total_buildings']) * 100
    
    return impact, zone_impact

if __name__ == "__main__":
    b_df = pd.DataFrame({'building_id': [1, 2], 'zone_id': ['z1', 'z1'], 'plinth_height': [0.2, 0.5]})
    p_df = pd.DataFrame({'zone_id': ['z1'], 'peak_depth_p50': [0.4], 'onset_30cm_hr': [14.0]})
    impact, summary = assess_building_impact(b_df, p_df)
    print(summary)
