# SMARTD WebSocket Device Simulator

This directory contains a Python script to simulate device data and broadcast it over a WebSocket connection. It is intended for frontend development, allowing you to test UI components without needing a live connection to the full backend and MQTT broker.

## How it Works

The script starts a WebSocket server and simulates multiple devices (`DT` and `EX` types). It periodically sends JSON messages to all connected WebSocket clients.

The output format of the data is designed to mimic the `DevicePositionUpdate` message sent by the `MqttToWebSocketService.cs` in the actual backend.

**WebSocket Server:** `ws://localhost:8765`

**Message Format:**
```json
{
  "type": "DevicePositionUpdate",
  "payload": {
    "deviceId": "SLS30I368",
    "unitNo": "DT5900",
    "deviceType": "DT",
    "latitude": 1.87895,
    "longitude": 117.155708,
    "lastHm": 3450.12,
    "lastSpeed": 14.5,
    "rpm": 1850.3,
    "timestamp": "2026-01-31T12:00:00.000000Z",
    "district": "BRCB",
    "rawJson": ""
  }
}
```

## How to Run

### 1. Prerequisites

- Python 3.7+
- `pip` for installing packages

### 2. Installation

Navigate to this directory in your terminal and install the required Python packages:
```bash
cd jiep-digi-mh02-smartd-monitor-system/frontend-v1/public/simulator
pip install -r requirements.txt
```

### 3. Running the Simulator

To start the simulator, run the following command from this directory:
```bash
python device-simulator.py
```
You should see output indicating that the server has started and is simulating devices.

### 4. Connecting Your Frontend

In your frontend application, you can now connect to the WebSocket server at `ws://localhost:8765`. You will receive `DevicePositionUpdate` messages in the format described above.

## Running as a Linux Service (systemd)

To run the simulator as a background service on a Linux system using `systemd`, you can use the provided `simulator.service` file as a template.

**NOTE:** You will need to edit the file to set the correct paths for your system.

1.  **Copy and Edit the Service File:**
    ```bash
    sudo cp simulator.service /etc/systemd/system/smartd-simulator.service
    sudo nano /etc/systemd/system/smartd-simulator.service
    ```
    -   Update `User` to your username.
    -   Update `WorkingDirectory` and `ExecStart` to the absolute paths on your machine.

2.  **Reload, Enable, and Start the Service:**
    ```bash
    # Reload systemd to recognize the new service
    sudo systemctl daemon-reload

    # Enable the service to start on boot
    sudo systemctl enable smartd-simulator.service

    # Start the service immediately
    sudo systemctl start smartd-simulator.service
    ```

3.  **Check Service Status:**
    ```bash
    sudo systemctl status smartd-simulator.service
    ```

4.  **View Logs:**
    ```bash
    sudo journalctl -u smartd-simulator.service -f
    ```
