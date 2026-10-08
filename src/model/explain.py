import numpy as np
import logging
import joblib
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_plain_language_drivers(features, model_dir="data/models"):
    """
    Translates feature values into structured, plain-language explanations (F16).
    Returns a dict with ranked drivers, a summary sentence, and percentage contributions.
    """
    
    drivers = []
    
    # Rainfall analysis
    rain = features.get('rain_24h', 0)
    rain_intensity = features.get('rain_peak_intensity', 0)
    if rain > 150:
        drivers.append({
            "name": "Extreme Rainfall",
            "detail": f"{rain:.0f} mm in 24h (above 150 mm threshold). Peak intensity {rain_intensity:.0f} mm/hr overwhelms storm drains within 1-2 hours.",
            "weight": min(95, 40 + (rain - 50) * 0.3),
            "category": "weather"
        })
    elif rain > 80:
        drivers.append({
            "name": "Heavy Rainfall",
            "detail": f"{rain:.0f} mm in 24h. Sustained downpour exceeds drainage design capacity of ~60 mm/hr in this zone.",
            "weight": min(85, 30 + (rain - 50) * 0.4),
            "category": "weather"
        })
    elif rain > 50:
        drivers.append({
            "name": "Moderate Rainfall",
            "detail": f"{rain:.0f} mm in 24h. Approaching drain capacity limits, especially if combined with high tide.",
            "weight": min(60, 20 + (rain - 30) * 0.5),
            "category": "weather"
        })
        
    # Tide analysis
    tide = features.get('tide_max', 0)
    if tide > 2.0:
        drivers.append({
            "name": "Extreme Tidal Surge",
            "detail": f"Tide at {tide:.1f} m blocks all gravity-fed drainage outfalls. Water has nowhere to go. Coastal backflow likely.",
            "weight": min(90, 35 + tide * 20),
            "category": "marine"
        })
    elif tide > 1.2:
        drivers.append({
            "name": "High Tide Blocking Drainage",
            "detail": f"Tide at {tide:.1f} m partially blocks outfalls. Drain efficiency drops by ~{min(80, int(tide * 30))}%.",
            "weight": min(75, 25 + tide * 15),
            "category": "marine"
        })
        
    # Elevation analysis
    elev = features.get('elevation_mean', 10)
    if elev < 0.5:
        drivers.append({
            "name": "Very Low Elevation",
            "detail": f"Zone sits at {elev:.1f} m above sea level. Water pools here naturally -- this area is a topographic sink.",
            "weight": 70,
            "category": "terrain"
        })
    elif elev < 2.0:
        drivers.append({
            "name": "Low Elevation",
            "detail": f"Zone at {elev:.1f} m above sea level. Gravity drains slowly; runoff from higher zones collects here.",
            "weight": 45,
            "category": "terrain"
        })
        
    # Proximity to coast
    dist = features.get('distance_to_coast', 10)
    if dist < 0.3:
        drivers.append({
            "name": "Coastal Proximity",
            "detail": f"Only {dist:.1f} km from shoreline. Direct exposure to storm surge and wave overtopping.",
            "weight": 55,
            "category": "terrain"
        })
    elif dist < 1.0:
        drivers.append({
            "name": "Near-Coast Zone",
            "detail": f"{dist:.1f} km from shoreline. Tidal influence still affects drainage performance.",
            "weight": 30,
            "category": "terrain"
        })
        
    # Imperviousness (urbanization)
    imperv = features.get('imperviousness', 0)
    if imperv > 0.8:
        drivers.append({
            "name": "Dense Urbanization",
            "detail": f"Surface is {imperv:.0%} impervious (concrete/asphalt). Almost no natural absorption -- all rain becomes runoff.",
            "weight": 50,
            "category": "landuse"
        })
    elif imperv > 0.6:
        drivers.append({
            "name": "High Concrete Cover",
            "detail": f"Surface is {imperv:.0%} impervious. Limited soil absorption increases surface runoff by ~{int(imperv*100)}%.",
            "weight": 35,
            "category": "landuse"
        })
        
    # Drainage capacity
    drainage = features.get('drainage_proxy', 1.0)
    if drainage < 0.3:
        drivers.append({
            "name": "Poor Drainage Infrastructure",
            "detail": f"Drainage capacity rated {drainage:.0%}. Old or undersized storm drains cannot handle moderate rainfall events.",
            "weight": 55,
            "category": "infrastructure"
        })
    elif drainage < 0.6:
        drivers.append({
            "name": "Below-Average Drainage",
            "detail": f"Drainage capacity rated {drainage:.0%}. Drains cope with light rain but overflow during sustained events.",
            "weight": 30,
            "category": "infrastructure"
        })
    
    # Sort by weight descending, take top 5
    drivers.sort(key=lambda d: d['weight'], reverse=True)
    drivers = drivers[:5]
    
    # Normalize weights to sum to 100
    total_w = sum(d['weight'] for d in drivers) if drivers else 1
    for d in drivers:
        d['pct'] = int(round(float(d['weight']) / float(total_w) * 100))
    
    # Generate a plain-English summary
    if not drivers:
        summary = "No significant flood drivers detected for this zone at the current time. Conditions are within normal parameters."
    elif len(drivers) == 1:
        summary = f"The primary risk factor is {drivers[0]['name'].lower()}. {drivers[0]['detail']}"
    else:
        top_names = [d['name'].lower() for d in drivers[:3]]
        summary = f"This zone is at risk primarily due to {', '.join(top_names[:-1])} and {top_names[-1]}. "
        summary += drivers[0]['detail']
    
    return {
        "drivers": [{"name": d['name'], "detail": d['detail'], "pct": d['pct'], "category": d['category']} for d in drivers],
        "summary": summary
    }

if __name__ == "__main__":
    feats = {
        'rain_24h': 180.0,
        'rain_peak_intensity': 55.0,
        'tide_max': 2.5,
        'elevation_mean': 0.5,
        'distance_to_coast': 0.3,
        'imperviousness': 0.85,
        'drainage_proxy': 0.25
    }
    
    result = generate_plain_language_drivers(feats)
    print(result['summary'])
    for d in result['drivers']:
        print(f"  [{d['pct']}%] {d['name']}: {d['detail']}")
