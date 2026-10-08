import pandas as pd
import numpy as np

def get_simulated_data(time_val=14):
    """
    Provides mock standalone data mapped to 12 zones, returning 
    probabilities and depth based on the current 'time_val' scrubber.
    """
    zones = pd.DataFrame({
        'zone_id': [f'Z{i}' for i in range(12)],
        'name': [
            'PANAMBUR', 'SURATHKAL', 'KULOOR', 'KOTTARA', 
            'BUNDER', 'HAMPANKATTA', 'MANGALADEVI', 'ULLAL', 
            'PADIL', 'KANKANADY', 'YEYYADI', 'KAVOOR'
        ],
        'lat': [12.95, 12.98, 12.91, 12.90, 12.86, 12.87, 12.84, 12.80, 12.87, 12.88, 12.91, 12.93],
        'lon': [74.81, 74.79, 74.83, 74.84, 74.83, 74.85, 74.84, 74.85, 74.89, 74.86, 74.86, 74.84],
        'base_p': [0.92, 0.45, 0.85, 0.78, 0.95, 0.30, 0.65, 0.88, 0.15, 0.25, 0.10, 0.20],
        'base_depth': [1.2, 0.4, 0.8, 0.6, 1.5, 0.1, 0.5, 1.1, 0.05, 0.1, 0.0, 0.05],
        'onset_hr': [14, 16, 14, 15, 13, 99, 16, 14, 99, 99, 99, 99],
        'peak_hr': [16, 18, 16, 17, 15, 99, 17, 15, 99, 99, 99, 99],
        'drivers': [
            'high tide + 85 mm rain + low elevation',
            'heavy rain + concrete density',
            'tide blocking drainage + 60 mm rain',
            'low elevation + 70 mm rain',
            'extreme surge + low elevation + high tide',
            '-',
            'poor drainage + 65 mm rain',
            'tide + river overflow + 80 mm rain',
            '-', '-', '-', '-'
        ],
        'facilities': [
            'Port Auth, NH-66', 'NITK Clinic', 'Kuloor Bridge', 'Infosys Road',
            'Central Market, State Bank', '-', 'Mangaladevi Temple Rd', 'Ullal Bridge',
            '-', '-', '-', '-'
        ]
    })
    
    # Scale based on time
    intensity = max(0, min(1, (time_val - 10) / 6))
    
    zones['p_flood'] = np.clip(zones['base_p'] * (0.2 + 0.8 * intensity), 0, 1)
    zones['peak_depth'] = np.clip(zones['base_depth'] * intensity, 0, 3.5)
    
    def get_severity(depth):
        if depth < 0.1: return "LOW"
        elif depth < 0.4: return "MODERATE"
        elif depth < 0.8: return "HIGH"
        else: return "SEVERE"
        
    def get_color(sev):
        if sev == "LOW": return [79, 163, 165, 200]
        elif sev == "MODERATE": return [217, 164, 65, 200]
        elif sev == "HIGH": return [224, 123, 57, 200]
        else: return [214, 69, 69, 200]
        
    def get_class(sev):
        return f"bg-{sev.lower()}"
        
    zones['severity'] = zones['peak_depth'].apply(get_severity)
    zones['color'] = zones['severity'].apply(get_color)
    zones['css_class'] = zones['severity'].apply(get_class)
    
    zones['onset'] = zones['onset_hr'].apply(lambda x: f"{int(x)}:{int((x%1)*60):02d}" if x < 24 else "N/A")
    zones['peak'] = zones['peak_hr'].apply(lambda x: f"{int(x)}:{int((x%1)*60):02d}" if x < 24 else "N/A")
    
    # RPI Score
    zones['rpi'] = zones['p_flood'] * zones['peak_depth'] * 100
    
    return zones

def get_chart_data():
    t = np.arange(0, 24, 1)
    return pd.DataFrame({
        'time': t,
        'rain': np.exp(-0.5 * ((t - 14) / 2)**2) * 50,
        'tide': np.sin(t / 12 * np.pi) * 1.5
    })
