import pandas as pd
import numpy as np
import logging
import networkx as nx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def compute_time_to_safety(road_impact_df, facilities_df, graph=None):
    """
    Computes travel time to the nearest reachable facility considering road closures (F13).
    """
    logger.info("Computing time-to-safety field...")
    
    # In a real implementation, 'graph' would be an osmnx graph of the roads.
    # For MVP, we provide a placeholder that identifies "medical desert" zones.
    
    results = []
    
    # Simple proxy: if all roads in a zone are closed, it's a medical desert
    zone_closures = road_impact_df.groupby('zone_id')['is_closed'].mean()
    
    for zone, closure_pct in zone_closures.items():
        if closure_pct > 0.8: # 80% roads closed
            time_to_safety = 999  # Unreachable
            is_desert = True
        else:
            # Mock travel time (10 to 60 minutes based on closure pct)
            time_to_safety = 10 + (closure_pct * 50)
            is_desert = False
            
        results.append({
            'zone_id': zone,
            'time_to_safety_mins': time_to_safety,
            'medical_desert_flag': is_desert
        })
        
    return pd.DataFrame(results)

if __name__ == "__main__":
    r_impact = pd.DataFrame({'zone_id': ['z1', 'z1', 'z2', 'z2'], 'is_closed': [True, True, False, False]})
    safety_df = compute_time_to_safety(r_impact, pd.DataFrame())
    print(safety_df)
