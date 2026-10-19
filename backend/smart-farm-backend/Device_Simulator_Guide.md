# 🤖 Smart Farm Device Simulator Guide

## 📋 Overview

This Python script simulates a real IoT device (ESP32/Raspberry Pi) for testing the Smart Farm manual actions system. It provides realistic device behavior including:

- ✅ **MQTT Communication**: Subscribes to action topics and publishes acknowledgments
- ✅ **Hardware Simulation**: Realistic execution delays and state management
- ✅ **Error Simulation**: Configurable success/failure rates for testing
- ✅ **Device Status**: Heartbeat and status updates
- ✅ **Complete Protocol**: Follows the exact acknowledgment protocol

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd smart-farm-backend
pip install -r requirements_simulator.txt
```

### 2. Start the Simulator
```bash
# Basic usage (uses EMQX Cloud by default)
python device_simulator.py

# Custom device ID
python device_simulator.py --device-id greenhouse01

# Custom MQTT broker (if using different broker)
python device_simulator.py --broker-url wss://your-broker.com:8084/mqtt --username your_user --password your_pass

# Lower success rate for testing failures
python device_simulator.py --success-rate 0.6

# Verbose logging
python device_simulator.py --verbose
```

### 3. Test from Dashboard
1. Open Smart Farm dashboard: `http://localhost:4200`
2. Go to **Manual Actions** tab
3. Execute actions on the simulated device
4. Watch real-time acknowledgments! ✨

---

## 🎯 Command Line Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--device-id` | `-d` | `dht11h` | Device identifier |
| `--broker-url` | `-b` | `wss://i37c1733.ala.us-east-1.emqxsl.com:8084/mqtt` | MQTT broker URL |
| `--username` | `-u` | `oussama2255` | MQTT username |
| `--password` | `-p` | `Oussama2255` | MQTT password |
| `--success-rate` | `-s` | `0.85` | Action success rate (0.0-1.0) |
| `--verbose` | `-v` | `false` | Enable debug logging |

---

## 📡 MQTT Topics

### Subscribed Topics (Incoming Actions)
```
smartfarm/actuators/{device_id}/fan_on
smartfarm/actuators/{device_id}/fan_off
smartfarm/actuators/{device_id}/irrigation_on
smartfarm/actuators/{device_id}/irrigation_off
smartfarm/actuators/{device_id}/heater_on
smartfarm/actuators/{device_id}/heater_off
smartfarm/actuators/{device_id}/lights_on
smartfarm/actuators/{device_id}/lights_off
smartfarm/actuators/{device_id}/open_roof
smartfarm/actuators/{device_id}/close_roof
smartfarm/actuators/{device_id}/alarm_on
smartfarm/actuators/{device_id}/alarm_off
smartfarm/actuators/{device_id}/restart
smartfarm/actuators/{device_id}/calibrate
```

### Published Topics (Outgoing Responses)
```
smartfarm/devices/{device_id}/ack      # Action acknowledgments
smartfarm/devices/{device_id}/status   # Device status/heartbeat
```

---

## 🔄 Simulation Behavior

### Device State Tracking
The simulator maintains realistic device state:
```python
device_state = {
    "fan": False,           # Fan on/off
    "irrigation": False,    # Irrigation system
    "heater": False,        # Heater status
    "lights": False,        # Lighting system
    "roof": "closed",       # Roof position (open/closed)
    "alarm": False          # Alarm system
}
```

### Execution Delays
- **Quick Actions** (fan, lights): 0.1-0.2 seconds
- **Medium Actions** (irrigation, heater): 0.3-0.5 seconds  
- **Slow Actions** (roof operations): 2.0 seconds
- **Complex Actions** (restart, calibrate): 1.0-3.0 seconds

### Error Simulation
- **Configurable Success Rate**: Default 85%
- **Realistic Error Messages**: Hardware failures, GPIO issues, etc.
- **State-based Errors**: Can't turn on what's already on
- **Random Hardware Failures**: Simulates real-world issues

---

## 📊 Example Output

```
🚀 Starting Smart Farm Device Simulator
📱 Device ID: dht11h
🌐 Broker: wss://i37c1733.ala.us-east-1.emqxsl.com:8084/mqtt
👤 Username: oussama2255
📊 Success Rate: 85%
🔗 Parsed broker: i37c1733.ala.us-east-1.emqxsl.com:8084 (SSL: True)
🔐 Authentication configured
🔒 SSL/TLS configured for secure connection
🔌 Connecting to i37c1733.ala.us-east-1.emqxsl.com:8084...
🔗 Device dht11h connected to MQTT broker
🎯 Subscribed to: smartfarm/actuators/dht11h/fan_on
🎯 Subscribed to: smartfarm/actuators/dht11h/fan_off
💓 Started heartbeat every 30 seconds

📨 Received action on smartfarm/actuators/dht11h/fan_off: {"actionId":"action_123","event":"action_triggered"...}
🔧 Processing action: fan_off (ID: action_123)
✅ Action fan_off completed successfully
📤 Sent success acknowledgment for action action_123
```

---

## 🧪 Testing Scenarios

### 1. Success Flow Testing
```bash
# High success rate for normal testing
python device_simulator.py --success-rate 0.95
```

### 2. Failure Testing
```bash
# Lower success rate to test error handling
python device_simulator.py --success-rate 0.3
```

### 3. Multiple Devices
```bash
# Terminal 1: Device 1
python device_simulator.py --device-id greenhouse01

# Terminal 2: Device 2  
python device_simulator.py --device-id greenhouse02

# Terminal 3: Device 3
python device_simulator.py --device-id outdoor_sensors
```

### 4. Network Issues Testing
```bash
# Stop/start simulator to test timeouts
python device_simulator.py
# Ctrl+C to stop, restart to simulate network issues
```

---

## 📋 Acknowledgment Protocol

### Success Response
```json
{
  "actionId": "action_1738123456789_abc123",
  "status": "success",
  "timestamp": "2025-01-10T08:45:02Z",
  "deviceId": "dht11h",
  "message": "Fan turned off successfully",
  "executionTime": 2.5,
  "action": "fan_off",
  "deviceState": {
    "fan": false,
    "irrigation": false,
    "heater": false,
    "lights": false,
    "roof": "closed",
    "alarm": false
  }
}
```

### Error Response
```json
{
  "actionId": "action_1738123456789_abc123",
  "status": "error",
  "timestamp": "2025-01-10T08:45:03Z",
  "deviceId": "dht11h",
  "error": "GPIO pin 5 not responding",
  "errorCode": "HARDWARE_ERROR",
  "action": "fan_off"
}
```

### Device Status Heartbeat
```json
{
  "deviceId": "dht11h",
  "status": "online",
  "timestamp": "2025-01-10T08:45:00Z",
  "lastSeen": "2025-01-10T08:45:00Z",
  "capabilities": ["fan_on", "fan_off", "irrigation_on", ...],
  "deviceState": {...},
  "uptime": 3600.5
}
```

---

## 🛠️ Customization

### Adding New Actions
```python
# 1. Add to action_handlers dict
self.action_handlers["new_action"] = self.handle_new_action

# 2. Add subscription topic
actions.append("new_action")

# 3. Implement handler
def handle_new_action(self) -> Dict[str, Any]:
    # Your hardware simulation logic
    return {"success": True, "message": "Action completed"}
```

### Modifying Success Rates
```python
# Different success rates per action
def execute_action(self, action: str, action_id: str, payload: Dict[str, Any]):
    action_success_rates = {
        "fan_on": 0.95,      # High reliability
        "irrigation_on": 0.80, # Medium reliability  
        "calibrate": 0.70     # Lower reliability
    }
    success_rate = action_success_rates.get(action, self.success_rate)
    success = random.random() < success_rate
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. MQTT Connection Failed
```
❌ Failed to connect to MQTT broker. Return code: 1
```
**Solution**: Check if MQTT broker is running:
```bash
# Check if Mosquitto is running
sudo systemctl status mosquitto

# Start if needed
sudo systemctl start mosquitto
```

#### 2. No Actions Received
**Solution**: Verify device ID matches in dashboard and simulator:
```bash
python device_simulator.py --device-id dht11h --verbose
```

#### 3. Import Error
```
❌ Error: paho-mqtt not installed
```
**Solution**: Install dependencies:
```bash
pip install paho-mqtt
```

### Debug Mode
```bash
# Enable verbose logging to see all MQTT messages
python device_simulator.py --verbose
```

---

## 🎯 Integration with Real Devices

This simulator demonstrates the exact protocol real IoT devices should implement:

### ESP32/Arduino Code Structure
```cpp
// Subscribe to action topics
client.subscribe("smartfarm/actuators/device123/fan_on");

// Handle incoming messages
void callback(char* topic, byte* payload, unsigned int length) {
    // Parse action and actionId
    // Execute hardware action
    // Send acknowledgment to smartfarm/devices/device123/ack
}

// Send acknowledgment
void sendAck(String actionId, String status, String message) {
    StaticJsonDocument<200> doc;
    doc["actionId"] = actionId;
    doc["status"] = status;
    doc["message"] = message;
    doc["timestamp"] = getTimestamp();
    
    String payload;
    serializeJson(doc, payload);
    client.publish("smartfarm/devices/device123/ack", payload.c_str());
}
```

### Raspberry Pi/Python Structure
```python
import paho.mqtt.client as mqtt
import json
import RPi.GPIO as GPIO

def on_message(client, userdata, msg):
    # Parse action
    action_data = json.loads(msg.payload.decode())
    action_id = action_data['actionId']
    
    # Execute hardware action
    success = execute_hardware_action(action_data)
    
    # Send acknowledgment
    ack = {
        "actionId": action_id,
        "status": "success" if success else "error",
        "timestamp": datetime.now().isoformat()
    }
    client.publish(f"smartfarm/devices/{device_id}/ack", json.dumps(ack))
```

---

## ✅ Ready to Test!

Your Smart Farm system now has a complete testing environment:

1. **Backend**: Production-ready action dispatcher with QoS and timeouts
2. **Frontend**: Real-time action monitoring with pending states
3. **Device Simulator**: Realistic IoT device behavior for testing
4. **Documentation**: Complete protocol specification

Start the simulator and test your manual actions system! 🚀

```bash
python device_simulator.py --device-id dht11h --verbose
```

Then execute actions from the dashboard and watch the magic happen! ✨
