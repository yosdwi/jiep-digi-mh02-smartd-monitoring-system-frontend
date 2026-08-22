#!/usr/bin/env python3
import json
import time
import random
import asyncio
import websockets
from datetime import datetime, timedelta
import math

# --- SIMULATION CONFIGURATION ---
WEBSOCKET_HOST = "0.0.0.0"
WEBSOCKET_PORT = 8765
DISTRICT = "BRCB"

# --- Movement & State Configuration ---
TRAVEL_SPEED_DEGREES = 0.0001  # Simulated speed in degrees per tick
LOADING_TIME_S = 15  # Time in seconds for a DT to "load"
DUMPING_TIME_S = 10  # Time in seconds for a DT to "dump"
ARRIVAL_THRESHOLD_DEGREES = 0.00015 # How close to be considered "arrived"

# --- MAP & DEVICE CONFIGURATION ---

def web_mercator_to_latlon(x, y):
    lon = x / 20037508.34 * 180
    lat = y / 20037508.34 * 180
    lat = 180 / math.pi * (2 * math.atan(math.exp(lat * math.pi / 180)) - math.pi / 2)
    return lat, lon

min_x, max_x = 13049823.12513836, 13063576.225209888
min_y, max_y = 208144.99425370246, 220259.76754756965
min_lat, min_lon = web_mercator_to_latlon(min_x, min_y)
max_lat, max_lon = web_mercator_to_latlon(max_x, max_y)

BASE_LAT = min_lat + (max_lat - min_lat) * 0.5
BASE_LON = min_lon + (max_lon - min_lon) * 0.5

DEVICES_CONFIG = [
    {"deviceid": "DT01", "unitno": "DT5900", "devicetype": "DT", "base_lat": BASE_LAT + 0.001, "base_lon": BASE_LON + 0.001},
    {"deviceid": "DT02", "unitno": "DT4895", "devicetype": "DT", "base_lat": BASE_LAT - 0.001, "base_lon": BASE_LON - 0.001},
    {"deviceid": "EX01", "unitno": "EX2500", "devicetype": "EX", "base_lat": BASE_LAT + 0.000, "base_lon": BASE_LON + 0.002},
    {"deviceid": "EX02", "unitno": "EX3100", "devicetype": "EX", "base_lat": BASE_LAT + 0.003, "base_lon": BASE_LON - 0.000},
]

# Define static locations for simulation cycle
LOADERS = {
    "EX2500": {"lat": BASE_LAT + 0.000, "lon": BASE_LON + 0.002},
    "EX3100": {"lat": BASE_LAT + 0.003, "lon": BASE_LON - 0.000}
}
DISPOSAL_AREAS = [
    {"lat": BASE_LAT + 0.005, "lon": BASE_LON + 0.005},
    {"lat": BASE_LAT - 0.004, "lon": BASE_LON - 0.004}
]

# --- SIMULATOR CLASS ---

class DeviceSimulator:
    def __init__(self, device_config):
        self.config = device_config
        self.current_lat = device_config["base_lat"]
        self.current_lon = device_config["base_lon"]
        self.speed = 0
        self.engine_hours = random.uniform(1000, 5000)
        self.plm_status = 1

        if self.config["devicetype"] == "DT":
            self.state = "TRAVELLING_TO_LOADER"
            self.target_loader = random.choice(list(LOADERS.values()))
            self.target_disposal = random.choice(DISPOSAL_AREAS)
            self.wait_timer = 0
            print(f"INFO: DT {self.config['unitno']} initialized, heading to loader.")

    def _move_towards(self, target_pos):
        dx = target_pos['lon'] - self.current_lon
        dy = target_pos['lat'] - self.current_lat
        distance = math.sqrt(dx**2 + dy**2)

        if distance < ARRIVAL_THRESHOLD_DEGREES:
            self.current_lon = target_pos['lon']
            self.current_lat = target_pos['lat']
            return True # Arrived

        # Move towards target
        self.current_lon += (dx / distance) * TRAVEL_SPEED_DEGREES
        self.current_lat += (dy / distance) * TRAVEL_SPEED_DEGREES
        self.speed = random.uniform(25, 40)
        return False # Still travelling

    def _update_dt_state_and_movement(self):
        old_state = self.state
        
        if self.state == "TRAVELLING_TO_LOADER":
            self.plm_status = 1 # Travelling Empty
            if self._move_towards(self.target_loader):
                self.state = "LOADING"
                self.wait_timer = time.time() + LOADING_TIME_S
        
        elif self.state == "LOADING":
            self.plm_status = 3 # Loading
            self.speed = 0
            if time.time() >= self.wait_timer:
                self.state = "TRAVELLING_TO_DISPOSAL"

        elif self.state == "TRAVELLING_TO_DISPOSAL":
            self.plm_status = 4 # Travelling Loaded
            if self._move_towards(self.target_disposal):
                self.state = "DUMPING"
                self.wait_timer = time.time() + DUMPING_TIME_S

        elif self.state == "DUMPING":
            self.plm_status = 8 # Dumping
            self.speed = 0
            if time.time() >= self.wait_timer:
                self.state = "TRAVELLING_TO_LOADER"
                # Pick a new random loader for variety
                self.target_loader = random.choice(list(LOADERS.values()))

        if old_state != self.state:
            print(f"INFO: {self.config['unitno']} state: {old_state} -> {self.state}")


    def simulate_movement(self):
        if self.config["devicetype"] == "DT":
            self._update_dt_state_and_movement()
        else: # EX units just jitter around
            self.current_lat += random.uniform(-0.00001, 0.00001)
            self.current_lon += random.uniform(-0.00001, 0.00001)
            self.speed = random.uniform(0, 2)

    def generate_device_data(self):
        self.simulate_movement()
        self.engine_hours += 0.01

        return {
            "deviceid": self.config["deviceid"],
            "unitno": self.config["unitno"],
            "devicetype": self.config["devicetype"],
            "gpslat": round(self.current_lat, 6),
            "gpslong": round(self.current_lon, 6),
            "HM": round(self.engine_hours, 2),
            "VehicleSpeed": round(self.speed, 1),
            "rpm": round(random.uniform(800, 2200), 1) if self.speed > 0 else 700,
            "plm_status": self.plm_status
        }

def transform_to_websocket_format(raw_data):
    return {
        "deviceId": raw_data.get("deviceid"),
        "unitNo": raw_data.get("unitno"),
        "deviceType": raw_data.get("devicetype"),
        "latitude": raw_data.get("gpslat"),
        "longitude": raw_data.get("gpslong"),
        "lastHm": raw_data.get("HM"),
        "lastSpeed": raw_data.get("VehicleSpeed"),
        "rpm": raw_data.get("rpm"),
        "timestamp": (datetime.utcnow() + timedelta(hours=8)).isoformat() + "Z",
        "district": DISTRICT,
        "rawJson": ""
    }

# --- WEBSOCKET SERVER ---
CONNECTED_CLIENTS = set()

async def connection_handler(websocket):
    CONNECTED_CLIENTS.add(websocket)
    print(f"INFO: Client connected: {websocket.remote_address}. Total: {len(CONNECTED_CLIENTS)}")
    try:
        await websocket.wait_closed()
    finally:
        CONNECTED_CLIENTS.remove(websocket)
        print(f"INFO: Client disconnected. Total: {len(CONNECTED_CLIENTS)}")

async def simulation_loop():
    simulators = [DeviceSimulator(config) for config in DEVICES_CONFIG]
    
    while True:
        await asyncio.sleep(1) # Simulation tick rate
        if not CONNECTED_CLIENTS:
            continue

        for simulator in simulators:
            raw_data = simulator.generate_device_data()
            ws_data = transform_to_websocket_format(raw_data)
            
            message = {"type": "DevicePositionUpdate", "payload": ws_data}
            message_json = json.dumps(message)
            
            # Non-blocking broadcast
            for client in list(CONNECTED_CLIENTS):
                asyncio.create_task(client.send(message_json))

            # Optional: Log only DT movement to reduce noise
            if ws_data['deviceType'] == 'DT':
                 print(f"✓ {ws_data['unitNo']} ({ws_data['deviceType']}): Pos [{ws_data['latitude']:.4f}, {ws_data['longitude']:.4f}], Speed {ws_data['lastSpeed']} km/h")

async def main():
    print("=== SMARTD Enhanced WebSocket Device Simulator ===")
    server = await websockets.serve(connection_handler, WEBSOCKET_HOST, WEBSOCKET_PORT)
    print(f"INFO: Server running on ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT}")
    
    await simulation_loop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nINFO: Simulator stopped.")
