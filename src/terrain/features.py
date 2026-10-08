import pandas as pd
import geopandas as gpd
import h3
from shapely.geometry import Polygon
import os
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_h3_zones(bbox, resolution=9, output_dir="data/processed"):
    """
    Grids the study area into H3 hexagons at the specified resolution.
    """
    os.makedirs(output_dir, exist_ok=True)
    logger.info(f"Generating H3 resolution-{resolution} zones for bbox {bbox}...")
    
    south, west, north, east = bbox
    
    # Create a polygon for the bounding box
    geo_json_polygon = {
        "type": "Polygon",
        "coordinates": [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
    }
    
    try:
        # h3 v3.x
        hexagons = list(h3.polyfill(geo_json_polygon, resolution))
    except AttributeError:
        # h3 v4.x
        exterior = [(south, west), (south, east), (north, east), (north, west), (south, west)]
        polygon = h3.LatLngPoly(exterior)
        hexagons = list(h3.polygon_to_cells(polygon, resolution))
    
    zones = []
    for h in hexagons:
        try:
            # h3 v3.x
            boundaries = h3.h3_to_geo_boundary(h)
            lat, lng = h3.h3_to_geo(h)
        except AttributeError:
            # h3 v4.x
            boundaries = h3.cell_to_boundary(h)
            lat, lng = h3.cell_to_latlng(h)
            
        # H3 returns (lat, lng), we need (lng, lat) for shapely
        coords = [(lng_b, lat_b) for lat_b, lng_b in boundaries]
        
        zones.append({
            'zone_id': h,
            'geometry': Polygon(coords),
            'centroid_lat': lat,
            'centroid_lon': lng,
            'place_name': f"Zone {h[-4:]}" # Placeholder name
        })
        
    gdf_zones = gpd.GeoDataFrame(zones, crs="EPSG:4326")
    gdf_zones.to_parquet(os.path.join(output_dir, "zones.parquet"))
    logger.info(f"Generated {len(zones)} H3 zones and saved to zones.parquet.")
    return gdf_zones

def build_terrain_features(gdf_zones, output_dir="data/processed"):
    """
    Creates synthetic terrain features for each H3 zone.
    In a real scenario, this would sample a DEM and compute HAND.
    """
    logger.info("Building terrain features table...")
    
    features = []
    
    # Synthetic terrain generation: 
    # East is higher, West (coast) is lower
    min_lon, max_lon = gdf_zones.centroid_lon.min(), gdf_zones.centroid_lon.max()
    
    for _, row in gdf_zones.iterrows():
        # Fake elevation: sloping down to the west coast
        lon_normalized = (row.centroid_lon - min_lon) / (max_lon - min_lon + 1e-6)
        elevation = 2.0 + (lon_normalized * 25.0) # 2m to 27m
        
        # Add some noise
        elevation += np.random.normal(0, 2)
        elevation = max(0.5, elevation)
        
        dist_to_coast = lon_normalized * 10.0 # up to 10km
        
        features.append({
            'zone_id': row.zone_id,
            'elevation_mean': elevation,
            'elevation_min': max(0, elevation - 1),
            'elevation_max': elevation + 1,
            'slope_mean': np.random.uniform(0.5, 5.0),
            'sink_depth': np.random.exponential(0.2),
            'relative_elevation': elevation, # Mock
            'distance_to_coast': dist_to_coast,
            'distance_to_creek': np.random.uniform(0.1, 3.0),
            'imperviousness': np.random.uniform(0.2, 0.9),
            'drainage_proxy': np.random.uniform(0.3, 0.8)
        })
        
    df_features = pd.DataFrame(features)
    df_features.to_parquet(os.path.join(output_dir, "terrain_features.parquet"))
    logger.info(f"Saved terrain features for {len(features)} zones.")
    return df_features

if __name__ == "__main__":
    # Mangaluru bbox
    bbox = (12.83, 74.82, 12.93, 74.92)
    zones = generate_h3_zones(bbox)
    build_terrain_features(zones)
