import pandas as pd
import numpy as np
import logging
import os
from tqdm import tqdm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PoseidonSim:
    def __init__(self, terrain_features_path="data/processed/terrain_features.parquet"):
        self.terrain = pd.read_parquet(terrain_features_path)
        logger.info(f"Loaded terrain features for {len(self.terrain)} zones.")
        
    def curve_number_runoff(self, rainfall_mm, curve_number, antecedent_wetness):
        """
        Simplified SCS Curve Number runoff calculation.
        """
        S = (25400 / curve_number) - 254
        # Adjust S based on antecedent wetness (0 to 1)
        S_adjusted = S * (1 - antecedent_wetness * 0.5)
        
        Ia = 0.2 * S_adjusted
        
        if rainfall_mm <= Ia:
            return 0.0
        
        runoff = ((rainfall_mm - Ia)**2) / (rainfall_mm - Ia + S_adjusted)
        return runoff
        
    def tide_blocked_drainage(self, base_drainage_capacity, tide_level, outfall_elevation):
        """
        Calculates effective drainage capacity reduced by high tide.
        Uses sigmoid for smooth transition.
        """
        # If tide is much lower than outfall, factor is 0
        # If tide is much higher, factor approaches 1
        diff = tide_level - outfall_elevation
        # steepness parameter = 2.0
        blocking_factor = 1 / (1 + np.exp(-2.0 * diff))
        return base_drainage_capacity * (1 - blocking_factor)
        
    def simulate_event(self, event_id, rain_curve, tide_curve, surge):
        """
        Simulates one event and returns hourly depths for all zones.
        rain_curve: list of hourly rainfall (mm)
        tide_curve: list of hourly tide levels (m)
        """
        n_hours = len(rain_curve)
        
        zone_ids = self.terrain['zone_id'].values
        elevations = self.terrain['elevation_mean'].values
        dist_coast = self.terrain['distance_to_coast'].values
        impervious = self.terrain['imperviousness'].values
        drainage_base = self.terrain['drainage_proxy'].values * 20.0 # base capacity in mm/hr
        
        # CN mapped roughly from imperviousness (0.2 -> 60, 0.9 -> 95)
        curve_numbers = 50 + (impervious * 50)
        
        # State tracking
        current_water_depth = np.zeros(len(zone_ids)) # in mm
        
        results = []
        
        antecedent_wetness = np.random.uniform(0.1, 0.9)
        
        for h in range(n_hours):
            rain_h = rain_curve[h]
            tide_h = tide_curve[h] + surge
            
            # 1. Runoff generation
            # Vectorized CN calculation
            S = (25400 / curve_numbers) - 254
            S_adj = S * (1 - antecedent_wetness * 0.5)
            Ia = 0.2 * S_adj
            
            runoff = np.zeros_like(S)
            mask = rain_h > Ia
            if np.any(mask):
                runoff[mask] = ((rain_h - Ia[mask])**2) / (rain_h - Ia[mask] + S_adj[mask])
            
            # 2. Add to current water
            current_water_depth += runoff
            
            # 3. Tide-blocked drainage
            # Assume outfall elevation is somewhat related to distance to coast and elevation
            outfall_elev = np.clip(elevations - (dist_coast * 0.5), 0, None)
            
            # Vectorized tide blocking
            diff = tide_h - outfall_elev
            blocking_factor = 1 / (1 + np.exp(-2.0 * diff))
            effective_drainage = drainage_base * (1 - blocking_factor)
            
            # 4. Drainage
            drained = np.minimum(current_water_depth, effective_drainage)
            current_water_depth -= drained
            
            # 5. Coastal inundation
            # If tide is higher than elevation, and it's near coast
            coastal_water = tide_h - elevations
            is_connected = dist_coast < 2.0 # Simple connectivity proxy
            coastal_flooding_m = np.where((coastal_water > 0) & is_connected, coastal_water, 0)
            
            # Total depth in meters
            total_depth_m = (current_water_depth / 1000.0) + coastal_flooding_m
            
            # Store results
            for i, z in enumerate(zone_ids):
                results.append({
                    'event_id': event_id,
                    'zone_id': z,
                    'hour': h,
                    'depth_m': total_depth_m[i],
                    'rain_mm': rain_h,
                    'tide_m': tide_h
                })
                
        return results
        
def generate_scenarios(n_scenarios=10, output_dir="data/cache/replay"):
    """
    Generates synthetic scenarios (F2).
    """
    os.makedirs(output_dir, exist_ok=True)
    sim = PoseidonSim()
    
    all_results = []
    
    logger.info(f"Generating {n_scenarios} scenarios...")
    for ev in tqdm(range(n_scenarios)):
        
        # Scenario probability distribution: 60% mild, 30% moderate, 10% extreme
        rand_val = np.random.random()
        
        if rand_val < 0.6:
            # Mild/Normal Day (minimal to no flooding)
            peak_rain = np.random.uniform(0, 30)
            tide_amp = np.random.uniform(0.5, 1.2)
            surge = np.random.uniform(0, 0.2)
        elif rand_val < 0.9:
            # Moderate Event (Monsoon showers)
            peak_rain = np.random.uniform(30, 90)
            tide_amp = np.random.uniform(1.0, 1.8)
            surge = np.random.uniform(0.2, 0.8)
        else:
            # Extreme Event (Cyclone / Severe Monsoon)
            peak_rain = np.random.uniform(90, 250)
            tide_amp = np.random.uniform(1.5, 2.8)
            surge = np.random.uniform(0.8, 2.5)

        peak_hour = np.random.randint(4, 20)
        rain_curve = peak_rain * np.exp(-0.1 * (np.arange(24) - peak_hour)**2)
        
        # Synthetic tide curve (sine wave)
        tide_phase = np.random.uniform(0, 2 * np.pi)
        tide_curve = tide_amp * np.sin(np.arange(24) * 2 * np.pi / 12.42 + tide_phase) + 1.0
        
        res = sim.simulate_event(f"evt_{ev}", rain_curve, tide_curve, surge)
        all_results.extend(res)
        
    df_res = pd.DataFrame(all_results)
    
    # Generate labels
    logger.info("Computing labels...")
    
    labels = []
    for (evt, zone), group in df_res.groupby(['event_id', 'zone_id']):
        max_depth = group['depth_m'].max()
        peak_hour = group.loc[group['depth_m'].idxmax()]['hour']
        
        onset_10_mask = group['depth_m'] >= 0.10
        onset_10 = group.loc[onset_10_mask]['hour'].min() if onset_10_mask.any() else -1
        
        onset_30_mask = group['depth_m'] >= 0.30
        onset_30 = group.loc[onset_30_mask]['hour'].min() if onset_30_mask.any() else -1
        
        labels.append({
            'event_id': evt,
            'zone_id': zone,
            'p_flood': 1 if max_depth >= 0.10 else 0,
            'max_depth': max_depth,
            'peak_hour': peak_hour,
            'onset_10cm': onset_10,
            'onset_30cm': onset_30
        })
        
    df_labels = pd.DataFrame(labels)
    
    # Save
    df_res.to_parquet(os.path.join(output_dir, "scenario_timeseries.parquet"))
    df_labels.to_parquet(os.path.join(output_dir, "scenario_labels.parquet"))
    logger.info("Saved scenarios and labels.")

if __name__ == "__main__":
    generate_scenarios(n_scenarios=20)
