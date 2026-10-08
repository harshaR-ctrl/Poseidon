import pandas as pd
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def calculate_priority_index(predictions_df, building_summary, access_summary):
    """
    Calculates Responder Priority Index (F17).
    Formula: Hazard * (exposure + vulnerability + access_loss)
    """
    logger.info("Calculating Responder Priority Index...")
    
    # Merge datasets
    df = predictions_df.merge(building_summary, on='zone_id', how='left')
    df = df.merge(access_summary, on='zone_id', how='left')
    
    # Normalize components (0 to 1)
    df['hazard'] = np.clip(df['p_flood'] * (df['peak_depth_p50'] / 1.0), 0, 1) # Cap at 1m depth for normalization
    df['exposure'] = np.clip(df['flooded_pct'] / 100.0, 0, 1)
    
    # Vulnerability (Mock based on facilities or population demographics)
    df['vulnerability'] = np.random.uniform(0.1, 0.9, len(df))
    
    df['access_loss'] = np.clip(df['time_to_safety_mins'] / 120.0, 0, 1) # Cap at 2 hours
    
    # Calculate RPI
    df['rpi_score'] = df['hazard'] * (df['exposure'] + df['vulnerability'] + df['access_loss'])
    
    # Rank
    df = df.sort_values('rpi_score', ascending=False)
    df['rank'] = range(1, len(df) + 1)
    
    return df[['zone_id', 'rpi_score', 'rank', 'hazard', 'exposure', 'vulnerability', 'access_loss']]

if __name__ == "__main__":
    p_df = pd.DataFrame({'zone_id': ['z1', 'z2'], 'p_flood': [0.9, 0.2], 'peak_depth_p50': [0.8, 0.1]})
    b_df = pd.DataFrame({'zone_id': ['z1', 'z2'], 'flooded_pct': [80.0, 5.0]})
    a_df = pd.DataFrame({'zone_id': ['z1', 'z2'], 'time_to_safety_mins': [150, 15]})
    
    rpi = calculate_priority_index(p_df, b_df, a_df)
    print(rpi)
