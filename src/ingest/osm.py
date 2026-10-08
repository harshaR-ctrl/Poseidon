import requests
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon
import json
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_osm_data(bbox, output_dir="data/raw/osm"):
    """
    Downloads OSM data for roads and buildings using Overpass API.
    bbox format: (south, west, north, east)
    """
    os.makedirs(output_dir, exist_ok=True)
    south, west, north, east = bbox
    bbox_str = f"{south},{west},{north},{east}"
    
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    # Query for roads, buildings, and critical facilities
    overpass_query = f"""
    [out:json][timeout:25];
    (
      way["highway"]({bbox_str});
      way["building"]({bbox_str});
      node["amenity"~"hospital|school|fire_station|police"]({bbox_str});
      way["amenity"~"hospital|school|fire_station|police"]({bbox_str});
    );
    out body;
    >;
    out skel qt;
    """
    
    logger.info("Downloading OSM data from Overpass API...")
    response = requests.post(overpass_url, data={'data': overpass_query})
    
    if response.status_code == 200:
        data = response.json()
        out_file = os.path.join(output_dir, "study_area.json")
        with open(out_file, 'w') as f:
            json.dump(data, f)
        logger.info(f"Saved OSM data to {out_file}")
        return data
    else:
        logger.error(f"Failed to download OSM data. Status: {response.status_code}")
        return None

def process_osm_data(osm_json, output_dir="data/processed"):
    """
    Processes raw OSM JSON into geopandas dataframes for roads, buildings, and facilities.
    """
    os.makedirs(output_dir, exist_ok=True)
    logger.info("Processing OSM data...")
    
    nodes = {elem['id']: (elem['lon'], elem['lat']) for elem in osm_json['elements'] if elem['type'] == 'node'}
    
    roads = []
    buildings = []
    facilities = []
    
    for elem in osm_json['elements']:
        if elem['type'] == 'way':
            if 'nodes' not in elem:
                continue
            coords = [nodes[n] for n in elem['nodes'] if n in nodes]
            if len(coords) < 2:
                continue
                
            tags = elem.get('tags', {})
            geom = LineString(coords) if coords[0] != coords[-1] else Polygon(coords)
            
            if 'highway' in tags:
                roads.append({
                    'road_id': elem['id'],
                    'geometry': geom,
                    'road_type': tags.get('highway'),
                    'name': tags.get('name', 'Unknown')
                })
            
            if 'building' in tags:
                buildings.append({
                    'building_id': elem['id'],
                    'geometry': Polygon(coords) if len(coords) >= 3 else geom,
                    'building_type': tags.get('building'),
                    'plinth_height': 0.30  # Default assumption
                })
                
            if 'amenity' in tags and tags['amenity'] in ['hospital', 'school', 'fire_station', 'police']:
                facilities.append({
                    'facility_id': elem['id'],
                    'geometry': Point(coords[0]),  # Simplification
                    'facility_type': tags['amenity'],
                    'name': tags.get('name', 'Unknown')
                })
                
        elif elem['type'] == 'node':
            tags = elem.get('tags', {})
            if 'amenity' in tags and tags['amenity'] in ['hospital', 'school', 'fire_station', 'police']:
                facilities.append({
                    'facility_id': elem['id'],
                    'geometry': Point(nodes[elem['id']]),
                    'facility_type': tags['amenity'],
                    'name': tags.get('name', 'Unknown')
                })

    if roads:
        gdf_roads = gpd.GeoDataFrame(roads, crs="EPSG:4326")
        gdf_roads.to_parquet(os.path.join(output_dir, "roads.parquet"))
    
    if buildings:
        gdf_buildings = gpd.GeoDataFrame(buildings, crs="EPSG:4326")
        gdf_buildings.to_parquet(os.path.join(output_dir, "buildings.parquet"))
        
    if facilities:
        gdf_facilities = gpd.GeoDataFrame(facilities, crs="EPSG:4326")
        gdf_facilities.to_parquet(os.path.join(output_dir, "facilities.parquet"))
        
    logger.info("Saved processed OSM data to parquet files.")

if __name__ == "__main__":
    # Mangaluru example bbox
    bbox = (12.83, 74.82, 12.93, 74.92)
    osm_data = download_osm_data(bbox)
    if osm_data:
        process_osm_data(osm_data)
