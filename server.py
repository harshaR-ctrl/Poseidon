import os
import sys
import pandas as pd
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from src.model.infer import run_inference
from src.model.explain import generate_plain_language_drivers

app = Flask(__name__, static_folder='web')
CORS(app)

# Serve the frontend
@app.route('/')
def serve_index():
    return send_from_directory('web', 'index.html')



def get_safety_verdict(p_flood, depth, onset_hr):
    """
    Generates a household safety verdict: EVACUATE NOW, PREPARE TO LEAVE, or SAFE TO STAY.
    """
    if depth >= 0.6 and p_flood >= 0.7:
        hours_left = max(0, onset_hr - 14)  # relative to "now"
        return {
            "level": "EVACUATE",
            "label": "EVACUATE NOW",
            "message": f"Predicted water depth of {depth:.1f}m will make roads impassable. "
                       f"You have approximately {hours_left:.0f} hours before water reaches street level. "
                       f"Move to higher ground or designated shelter immediately.",
            "action": "Leave the area via elevated routes. Do not attempt to cross flooded roads.",
            "color": "#FF003C"
        }
    elif depth >= 0.3 and p_flood >= 0.5:
        return {
            "level": "PREPARE",
            "label": "PREPARE TO LEAVE",
            "message": f"Moderate flooding of {depth:.1f}m is likely. Ground floors will be affected. "
                       f"Prepare an emergency bag and monitor updates every 30 minutes.",
            "action": "Move valuables to upper floors. Identify your nearest exit route and shelter.",
            "color": "#FF3366"
        }
    elif depth >= 0.1 and p_flood >= 0.3:
        return {
            "level": "ALERT",
            "label": "STAY ALERT",
            "message": f"Minor flooding of {depth:.1f}m is possible. Unlikely to require evacuation "
                       f"but low-lying parking and basements may be affected.",
            "action": "Move vehicles from underground parking. Avoid low-lying walkways.",
            "color": "#FFC000"
        }
    else:
        return {
            "level": "SAFE",
            "label": "SAFE TO STAY",
            "message": "No significant flood risk detected for this zone at the current time. "
                       "Continue normal activities.",
            "action": "No action required. Re-check if weather conditions change.",
            "color": "#00F0FF"
        }

@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({"status": "ok"})

# API: Model Inference
@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        zones_list = data.get('zones', [])
        
        if not zones_list:
            return jsonify({"error": "No zones provided"}), 400
            
        df = pd.DataFrame(zones_list)
        
        # Run XGBoost Inference
        predictions = run_inference(df)
        
        if predictions is None:
            return jsonify({"error": "Model not trained. Run seed_and_train.py first."}), 500
            
        results = []
        for i, row in predictions.iterrows():
            zone_data = df.iloc[i].to_dict()
            explain = generate_plain_language_drivers(zone_data)
            
            p_flood = float(row['p_flood'])
            depth = float(row['peak_depth_p50'])
            onset = float(row['onset_10cm_hr'])
            peak_hr = float(row['peak_time_hr'])
            
            safety = get_safety_verdict(p_flood, depth, onset)
            
            results.append({
                "zone_id": row['zone_id'],
                "p_flood": p_flood,
                "peak_depth": depth,
                "depth_p10": float(row['peak_depth_p10']),
                "depth_p90": float(row['peak_depth_p90']),
                "onset_hr": onset,
                "peak_hr": peak_hr,
                "severity_class": row['severity_class'],
                "drivers": explain['drivers'],
                "summary": explain['summary'],
                "safety": safety
            })
            
        return jsonify({"predictions": results})
    except Exception as e:
        import traceback
        with open("error_log.txt", "w") as f:
            f.write(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('web', path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
