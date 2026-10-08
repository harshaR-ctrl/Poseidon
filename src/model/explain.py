import numpy as np
import logging
import joblib
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_plain_language_drivers(features, model_dir="data/models"):
    """
    Translates SHAP values into plain-language explanations (F16).
    """
    logger.info("Generating plain-language drivers...")
    
    # In a full implementation, we'd use shap.TreeExplainer here.
    # For MVP, we'll simulate the top drivers based on the features values relative to their means.
    
    drivers = []
    
    # Look at rain
    rain = features.get('rain_24h', 0)
    if rain > 50:
        drivers.append(f"Heavy rainfall ({rain:.1f} mm)")
        
    # Look at tide
    tide = features.get('tide_max', 0)
    if tide > 1.2:
        drivers.append(f"High tide blocking drainage ({tide:.1f} m)")
        
    # Look at terrain
    elev = features.get('elevation_mean', 10)
    if elev < 2.0:
        drivers.append("Low elevation zone")
        
    dist = features.get('distance_to_coast', 10)
    if dist < 1.0:
        drivers.append("Proximity to coast")
        
    imperv = features.get('imperviousness', 0)
    if imperv > 0.7:
        drivers.append("High concrete density reducing absorption")
        
    # Pick top 3
    if not drivers:
        return "Normal conditions."
        
    top_drivers = drivers[:3]
    return "Primary drivers: " + ", ".join(top_drivers) + "."

if __name__ == "__main__":
    feats = {
        'rain_24h': 120.0,
        'tide_max': 1.5,
        'elevation_mean': 1.0,
        'distance_to_coast': 0.5,
        'imperviousness': 0.8
    }
    
    print(generate_plain_language_drivers(feats))
