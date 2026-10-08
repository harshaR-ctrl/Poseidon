import pandas as pd
import geopandas as gpd
from shapely.geometry import Polygon
import os
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FRONTEND_ZONES = [
    { 'id': 'Z0', 'name': 'PANAMBUR',     'lat': 12.950, 'lon': 74.810, 'elev': 0.4, 'dist_coast': 0.2, 'imperv': 0.7, 'drainage': 0.35 },
    { 'id': 'Z1', 'name': 'SURATHKAL',    'lat': 12.980, 'lon': 74.790, 'elev': 1.8, 'dist_coast': 0.3, 'imperv': 0.6, 'drainage': 0.55 },
    { 'id': 'Z2', 'name': 'KULOOR',       'lat': 12.910, 'lon': 74.830, 'elev': 0.6, 'dist_coast': 0.8, 'imperv': 0.85, 'drainage': 0.25 },
    { 'id': 'Z3', 'name': 'KOTTARA',      'lat': 12.900, 'lon': 74.840, 'elev': 1.0, 'dist_coast': 1.2, 'imperv': 0.75, 'drainage': 0.40 },
    { 'id': 'Z4', 'name': 'BUNDER',       'lat': 12.860, 'lon': 74.830, 'elev': 0.3, 'dist_coast': 0.15, 'imperv': 0.90, 'drainage': 0.20 },
    { 'id': 'Z5', 'name': 'HAMPANKATTA',  'lat': 12.870, 'lon': 74.850, 'elev': 3.5, 'dist_coast': 2.0, 'imperv': 0.70, 'drainage': 0.65 },
    { 'id': 'Z6', 'name': 'MANGALADEVI',  'lat': 12.840, 'lon': 74.840, 'elev': 0.8, 'dist_coast': 0.6, 'imperv': 0.80, 'drainage': 0.30 },
    { 'id': 'Z7', 'name': 'ULLAL',        'lat': 12.800, 'lon': 74.850, 'elev': 0.5, 'dist_coast': 0.1, 'imperv': 0.65, 'drainage': 0.35 }
]

def generate_h3_zones(bbox=None, resolution=9, output_dir="data/processed"):
    """
    Returns a dummy GeoDataFrame of the exactly mapped frontend zones.
    """
    os.makedirs(output_dir, exist_ok=True)
    logger.info("Generating exact frontend zones...")
    
    zones = []
    for z in FRONTEND_ZONES:
        # Create a small dummy polygon around the lat/lon
        lat, lon = z['lat'], z['lon']
        coords = [(lon-0.01, lat-0.01), (lon+0.01, lat-0.01), (lon+0.01, lat+0.01), (lon-0.01, lat+0.01)]
        zones.append({
            'zone_id': z['id'],
            'geometry': Polygon(coords),
            'centroid_lat': lat,
            'centroid_lon': lon,
            'place_name': z['name']
        })
        
    gdf_zones = gpd.GeoDataFrame(zones, crs="EPSG:4326")
    gdf_zones.to_parquet(os.path.join(output_dir, "zones.parquet"))
    logger.info(f"Generated {len(zones)} UI zones and saved to zones.parquet.")
    return gdf_zones

ZONE_TERRAIN = {
    # slope_mean: degrees of local slope (flat coast vs hilly inland)
    # sink_depth: depth of topographic depression that collects water (m)
    'Z0': {'slope': 0.5, 'sink': 0.25},   # PANAMBUR - flat coastal, significant sink
    'Z1': {'slope': 2.8, 'sink': 0.08},   # SURATHKAL - NITK campus, sloped hillside
    'Z2': {'slope': 0.8, 'sink': 0.35},   # KULOOR - low industrial flat, deep sink
    'Z3': {'slope': 1.5, 'sink': 0.15},   # KOTTARA - moderate slope
    'Z4': {'slope': 0.3, 'sink': 0.40},   # BUNDER - very flat port area, deepest sink
    'Z5': {'slope': 3.5, 'sink': 0.02},   # HAMPANKATTA - steep hill, almost no sink
    'Z6': {'slope': 1.0, 'sink': 0.20},   # MANGALADEVI - moderate
    'Z7': {'slope': 0.4, 'sink': 0.30},   # ULLAL - flat coastal, significant sink
}

def build_terrain_features(gdf_zones, output_dir="data/processed"):
    """
    Creates terrain features that perfectly match the frontend parameters.
    Now includes per-zone slope and sink_depth for model differentiation.
    """
    logger.info("Building terrain features table...")
    
    features = []
    for z in FRONTEND_ZONES:
        zt = ZONE_TERRAIN.get(z['id'], {'slope': 1.0, 'sink': 0.15})
        features.append({
            'zone_id': z['id'],
            'elevation_mean': z['elev'],
            'elevation_min': max(0, z['elev'] - 0.5),
            'elevation_max': z['elev'] + 0.5,
            'slope_mean': zt['slope'],
            'sink_depth': zt['sink'],
            'relative_elevation': z['elev'],
            'distance_to_coast': z['dist_coast'],
            'distance_to_creek': 0.5,
            'imperviousness': z['imperv'],
            'drainage_proxy': z['drainage']
        })
        
    df_features = pd.DataFrame(features)
    df_features.to_parquet(os.path.join(output_dir, "terrain_features.parquet"))
    logger.info(f"Saved terrain features for {len(features)} zones.")
    return df_features

if __name__ == "__main__":
    zones = generate_h3_zones()
    build_terrain_features(zones)
