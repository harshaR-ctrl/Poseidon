import argparse
import requests
import json
import time

def trigger_live_scenario(args):
    import sys
    import random
    
    # If no arguments provided at all, randomly pick a preset
    if len(sys.argv) == 1:
        args.preset = random.choice(["low", "medium", "high", "severe"])

    # Apply presets if requested
    if args.preset:
        presets = {
            "low": {"name": "Low Risk (Light Rain)", "rain": 40, "tide": 1.0, "wind": 15},
            "medium": {"name": "Moderate Risk (Storm)", "rain": 90, "tide": 1.5, "wind": 30},
            "high": {"name": "High Risk (Heavy Monsoon)", "rain": 160, "tide": 2.1, "wind": 60},
            "mixed": {"name": "Mixed Predictions Demo", "rain": 42, "tide": 1.8, "wind": 25},
            "severe": {"name": "Severe Risk (Mega Tsunami)", "rain": 350, "tide": 4.5, "wind": 180},
            "random": {
                "name": f"Random Chaos Event ({random.randint(1000,9999)})",
                "rain": round(random.uniform(0, 400), 1),
                "tide": round(random.uniform(0.5, 5.0), 1),
                "wind": round(random.uniform(0, 200), 1)
            }
        }
        
        p = presets.get(args.preset.lower())
        if p:
            args.name = p["name"]
            args.rain = p["rain"]
            args.tide = p["tide"]
            args.wind = p["wind"]
        else:
            print(f"Unknown preset '{args.preset}'. Available: low, medium, high, severe, random")
            return

    # Construct scenario payload
    payload = {
        "name": f"Live Run: {args.name}",
        "desc": f"Custom real-time run. {args.rain}mm rain, {args.tide}m tide.",
        "rain_max": args.rain,
        "rain_peak": args.peak if args.peak else (args.rain * 0.3),
        "tide": args.tide,
        "wind": args.wind
    }

    print(f"\n[ POSEIDON LIVE SIMULATION TRIGGER ]")
    print(f"----------------------------------------")
    print(f"Sending parameters to dashboard server...")
    print(json.dumps(payload, indent=2))
    
    try:
        response = requests.post(f"http://127.0.0.1:{args.port}/api/scenario", json=payload, timeout=3)
        if response.status_code == 200:
            print("\n[SUCCESS] Payload accepted by the server.")
            print("Look at your Dashboard browser window now. It should automatically update and show the new predictions!")
        else:
            print(f"\n[FAILED] Server returned code {response.status_code}")
            print(response.text)
    except requests.exceptions.ConnectionError:
        print("\n[FAILED] Could not connect to the Dashboard API.")
        print(f"Are you sure the server is running on port {args.port}?")
        print("Run `python server.py` in another terminal first.")
    except Exception as e:
        print(f"\n[FAILED] {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trigger real-time flood simulations on the Poseidon Dashboard.")
    parser.add_argument("--preset", type=str, default=None, help="Use a predefined risk level: low, medium, high, severe. Overrides other args.")
    parser.add_argument("--name", type=str, default="Terminal Triggered Event", help="Name of the custom scenario")
    parser.add_argument("--rain", type=float, default=42.0, help="Total 24h Rainfall in mm")
    parser.add_argument("--peak", type=float, default=None, help="Peak hourly rainfall intensity (default: 30% of total)")
    parser.add_argument("--tide", type=float, default=1.8, help="Maximum tide level in meters")
    parser.add_argument("--wind", type=float, default=25.0, help="Wind speed in km/h")
    parser.add_argument("--port", type=int, default=8080, help="Port of the running dashboard server")
    
    args = parser.parse_args()
    trigger_live_scenario(args)
