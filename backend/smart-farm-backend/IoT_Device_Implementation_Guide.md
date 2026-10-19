# 🚀 Smart Farm IoT Device Acknowledgment System
## Implementation Guide for IoT Team

---

## 📋 **Overview**

This document provides a complete implementation guide for IoT devices to integrate with the Smart Farm's **Production-Ready Action Acknowledgment System**. The system ensures reliable two-way communication between the backend and IoT devices.

---

## 🎯 **Key Benefits**

✅ **Guaranteed Delivery**: Know exactly when actions are executed  
✅ **Error Handling**: Detect and handle device failures  
✅ **Real-time Status**: Live updates on action execution  
✅ **Production Ready**: Enterprise-grade reliability  
✅ **Audit Trail**: Complete action lifecycle tracking  

---

## 🔧 **System Architecture**

```
┌─────────────────┐    MQTT Command     ┌─────────────────┐
│   Smart Farm    │ ──────────────────► │   IoT Device    │
│    Backend      │                     │                 │
│                 │ ◄────────────────── │                 │
└─────────────────┘    MQTT Acknowledgment └─────────────────┘
```

### **Command Flow:**
1. **Backend** publishes action command to `smartfarm/actuators/{device_id}/{action}`
2. **Device** receives command, executes action
3. **Device** publishes acknowledgment to `smartfarm/devices/{device_id}/ack`
4. **Backend** updates action status and notifies frontend

---

## 📡 **MQTT Topics**

### **Command Topics (Backend → Device):**
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

### **Acknowledgment Topics (Device → Backend):**
```
smartfarm/devices/{device_id}/ack
smartfarm/devices/{device_id}/status
```

---

## 📨 **Message Formats**

### **Command Message Format:**
```json
{
  "event": "action_triggered",
  "actionId": "action_1738123456789_abc123",
  "sensor": "manual",
  "sensorId": "manual_trigger",
  "deviceId": "dht11h",
  "value": 0,
  "unit": "",
  "violationType": "manual",
  "timestamp": "2025-01-10T08:45:00Z",
  "action": "fan_off",
  "actionType": "normal",
  "requiresConfirmation": false,
  "retryCount": 0,
  "maxRetries": 1
}
```

### **Success Acknowledgment Format:**
```json
{
  "actionId": "action_1738123456789_abc123",
  "status": "success",
  "timestamp": "2025-01-10T08:45:05Z",
  "deviceId": "dht11h",
  "action": "fan_off",
  "executionTime": 2.5,
  "message": "Fan turned off successfully"
}
```

### **Error Acknowledgment Format:**
```json
{
  "actionId": "action_1738123456789_abc123",
  "status": "error",
  "error": "Device offline",
  "timestamp": "2025-01-10T08:45:05Z",
  "deviceId": "dht11h",
  "action": "fan_off",
  "errorCode": "DEVICE_OFFLINE",
  "message": "Unable to execute action - device not responding"
}
```

### **Device Status Format:**
```json
{
  "deviceId": "dht11h",
  "status": "online",
  "timestamp": "2025-01-10T08:45:00Z",
  "capabilities": ["fan", "irrigation", "heater"],
  "lastSeen": "2025-01-10T08:45:00Z",
  "batteryLevel": 85,
  "signalStrength": -45
}
```

---

## 🛠️ **Implementation Examples**

### **Python Implementation (Raspberry Pi/ESP32):**

```python
import paho.mqtt.client as mqtt
import json
import time
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SmartFarmDevice:
    def __init__(self, device_id, mqtt_broker, mqtt_port=1883):
        self.device_id = device_id
        self.mqtt_broker = mqtt_broker
        self.mqtt_port = mqtt_port
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        # Device capabilities
        self.capabilities = ["fan", "irrigation", "heater", "lights"]
        self.status = "online"
        
    def connect(self):
        """Connect to MQTT broker"""
        try:
            self.client.connect(self.mqtt_broker, self.mqtt_port, 60)
            self.client.loop_start()
            logger.info(f"Connected to MQTT broker: {self.mqtt_broker}")
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            
    def on_connect(self, client, userdata, flags, rc):
        """Callback when connected to MQTT broker"""
        if rc == 0:
            logger.info("Successfully connected to MQTT broker")
            
            # Subscribe to command topics
            command_topic = f"smartfarm/actuators/{self.device_id}/+"
            client.subscribe(command_topic)
            logger.info(f"Subscribed to: {command_topic}")
            
            # Publish initial status
            self.publish_status()
            
        else:
            logger.error(f"Failed to connect to MQTT broker. Return code: {rc}")
            
    def on_message(self, client, userdata, message):
        """Callback when message is received"""
        try:
            topic = message.topic
            payload = json.loads(message.payload.decode())
            
            logger.info(f"Received command on {topic}: {payload}")
            
            # Extract action from topic
            action = topic.split('/')[-1]
            action_id = payload.get('actionId')
            
            if not action_id:
                logger.warning("No actionId in command payload")
                return
                
            # Execute the action
            self.execute_action(action, action_id, payload)
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in message: {e}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            
    def execute_action(self, action, action_id, payload):
        """Execute the requested action"""
        start_time = time.time()
        
        try:
            logger.info(f"Executing action: {action}")
            
            # Execute based on action type
            if action == "fan_on":
                self.turn_on_fan()
            elif action == "fan_off":
                self.turn_off_fan()
            elif action == "irrigation_on":
                self.turn_on_irrigation()
            elif action == "irrigation_off":
                self.turn_off_irrigation()
            elif action == "heater_on":
                self.turn_on_heater()
            elif action == "heater_off":
                self.turn_off_heater()
            elif action == "lights_on":
                self.turn_on_lights()
            elif action == "lights_off":
                self.turn_off_lights()
            elif action == "open_roof":
                self.open_roof()
            elif action == "close_roof":
                self.close_roof()
            elif action == "alarm_on":
                self.enable_alarm()
            elif action == "alarm_off":
                self.disable_alarm()
            elif action == "restart":
                self.restart_device()
            elif action == "calibrate":
                self.calibrate_sensors()
            else:
                raise ValueError(f"Unknown action: {action}")
                
            # Calculate execution time
            execution_time = time.time() - start_time
            
            # Publish success acknowledgment
            self.publish_acknowledgment(action_id, "success", execution_time=execution_time)
            
        except Exception as e:
            logger.error(f"Failed to execute action {action}: {e}")
            
            # Publish error acknowledgment
            self.publish_acknowledgment(action_id, "error", error=str(e))
            
    def publish_acknowledgment(self, action_id, status, execution_time=None, error=None):
        """Publish action acknowledgment"""
        ack_topic = f"smartfarm/devices/{self.device_id}/ack"
        
        ack_payload = {
            "actionId": action_id,
            "status": status,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "deviceId": self.device_id
        }
        
        if execution_time is not None:
            ack_payload["executionTime"] = execution_time
            
        if error is not None:
            ack_payload["error"] = error
            ack_payload["errorCode"] = "EXECUTION_ERROR"
            
        try:
            self.client.publish(ack_topic, json.dumps(ack_payload), qos=1)
            logger.info(f"Published acknowledgment: {status}")
        except Exception as e:
            logger.error(f"Failed to publish acknowledgment: {e}")
            
    def publish_status(self):
        """Publish device status"""
        status_topic = f"smartfarm/devices/{self.device_id}/status"
        
        status_payload = {
            "deviceId": self.device_id,
            "status": self.status,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "capabilities": self.capabilities,
            "lastSeen": datetime.utcnow().isoformat() + "Z",
            "batteryLevel": self.get_battery_level(),
            "signalStrength": self.get_signal_strength()
        }
        
        try:
            self.client.publish(status_topic, json.dumps(status_payload), qos=1)
            logger.info("Published device status")
        except Exception as e:
            logger.error(f"Failed to publish status: {e}")
            
    def on_disconnect(self, client, userdata, rc):
        """Callback when disconnected from MQTT broker"""
        logger.warning(f"Disconnected from MQTT broker. Return code: {rc}")
        
    # Device-specific action implementations
    def turn_on_fan(self):
        """Turn on fan - implement your hardware control here"""
        logger.info("Turning on fan")
        # GPIO control, relay control, etc.
        # time.sleep(0.1)  # Simulate hardware operation
        
    def turn_off_fan(self):
        """Turn off fan - implement your hardware control here"""
        logger.info("Turning off fan")
        # GPIO control, relay control, etc.
        
    def turn_on_irrigation(self):
        """Turn on irrigation - implement your hardware control here"""
        logger.info("Turning on irrigation")
        # Water pump control, valve control, etc.
        
    def turn_off_irrigation(self):
        """Turn off irrigation - implement your hardware control here"""
        logger.info("Turning off irrigation")
        # Water pump control, valve control, etc.
        
    def turn_on_heater(self):
        """Turn on heater - implement your hardware control here"""
        logger.info("Turning on heater")
        # Heating element control, etc.
        
    def turn_off_heater(self):
        """Turn off heater - implement your hardware control here"""
        logger.info("Turning off heater")
        # Heating element control, etc.
        
    def turn_on_lights(self):
        """Turn on lights - implement your hardware control here"""
        logger.info("Turning on lights")
        # LED control, relay control, etc.
        
    def turn_off_lights(self):
        """Turn off lights - implement your hardware control here"""
        logger.info("Turning off lights")
        # LED control, relay control, etc.
        
    def open_roof(self):
        """Open roof - implement your hardware control here"""
        logger.info("Opening roof")
        # Motor control, actuator control, etc.
        
    def close_roof(self):
        """Close roof - implement your hardware control here"""
        logger.info("Closing roof")
        # Motor control, actuator control, etc.
        
    def enable_alarm(self):
        """Enable alarm - implement your hardware control here"""
        logger.info("Enabling alarm")
        # Buzzer control, LED control, etc.
        
    def disable_alarm(self):
        """Disable alarm - implement your hardware control here"""
        logger.info("Disabling alarm")
        # Buzzer control, LED control, etc.
        
    def restart_device(self):
        """Restart device - implement your hardware control here"""
        logger.info("Restarting device")
        # System restart, watchdog reset, etc.
        
    def calibrate_sensors(self):
        """Calibrate sensors - implement your hardware control here"""
        logger.info("Calibrating sensors")
        # Sensor calibration routines, etc.
        
    def get_battery_level(self):
        """Get battery level - implement your hardware reading here"""
        # Battery voltage reading, etc.
        return 85  # Example: 85%
        
    def get_signal_strength(self):
        """Get signal strength - implement your hardware reading here"""
        # WiFi/Radio signal strength reading, etc.
        return -45  # Example: -45 dBm

# Usage example
if __name__ == "__main__":
    # Configuration
    DEVICE_ID = "dht11h"  # Your device ID
    MQTT_BROKER = "7.tcp.eu.ngrok.io"  # Your MQTT broker
    MQTT_PORT = 18025  # Your MQTT port
    
    # Create and start device
    device = SmartFarmDevice(DEVICE_ID, MQTT_BROKER, MQTT_PORT)
    device.connect()
    
    try:
        # Keep the device running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down device...")
        device.client.loop_stop()
        device.client.disconnect()
```

### **Arduino/ESP32 Implementation:**

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "7.tcp.eu.ngrok.io";
const int mqtt_port = 18025;
const char* device_id = "dht11h";

// MQTT client
WiFiClient espClient;
PubSubClient client(espClient);

// Device capabilities
String capabilities[] = {"fan", "irrigation", "heater", "lights"};
int capabilityCount = 4;

void setup() {
  Serial.begin(115200);
  
  // Initialize WiFi
  setup_wifi();
  
  // Initialize MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(on_message);
  
  // Initialize hardware pins
  setup_hardware();
  
  Serial.println("Smart Farm Device Started");
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void setup_hardware() {
  // Initialize GPIO pins for actuators
  pinMode(FAN_PIN, OUTPUT);
  pinMode(IRRIGATION_PIN, OUTPUT);
  pinMode(HEATER_PIN, OUTPUT);
  pinMode(LIGHTS_PIN, OUTPUT);
  
  // Set initial states
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(IRRIGATION_PIN, LOW);
  digitalWrite(HEATER_PIN, LOW);
  digitalWrite(LIGHTS_PIN, LOW);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Publish status every 30 seconds
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus > 30000) {
    publish_status();
    lastStatus = millis();
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    if (client.connect(device_id)) {
      Serial.println("connected");
      
      // Subscribe to command topics
      String command_topic = "smartfarm/actuators/" + String(device_id) + "/+";
      client.subscribe(command_topic.c_str());
      Serial.println("Subscribed to: " + command_topic);
      
      // Publish initial status
      publish_status();
      
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void on_message(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.println("Received: " + String(topic) + " - " + message);
  
  // Parse JSON
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, message);
  
  String action_id = doc["actionId"];
  String action = String(topic).substring(String(topic).lastIndexOf('/') + 1);
  
  if (action_id.length() > 0) {
    execute_action(action, action_id);
  }
}

void execute_action(String action, String action_id) {
  bool success = false;
  unsigned long start_time = millis();
  
  Serial.println("Executing action: " + action);
  
  if (action == "fan_on") {
    digitalWrite(FAN_PIN, HIGH);
    success = true;
  }
  else if (action == "fan_off") {
    digitalWrite(FAN_PIN, LOW);
    success = true;
  }
  else if (action == "irrigation_on") {
    digitalWrite(IRRIGATION_PIN, HIGH);
    success = true;
  }
  else if (action == "irrigation_off") {
    digitalWrite(IRRIGATION_PIN, LOW);
    success = true;
  }
  else if (action == "heater_on") {
    digitalWrite(HEATER_PIN, HIGH);
    success = true;
  }
  else if (action == "heater_off") {
    digitalWrite(HEATER_PIN, LOW);
    success = true;
  }
  else if (action == "lights_on") {
    digitalWrite(LIGHTS_PIN, HIGH);
    success = true;
  }
  else if (action == "lights_off") {
    digitalWrite(LIGHTS_PIN, LOW);
    success = true;
  }
  else {
    Serial.println("Unknown action: " + action);
  }
  
  unsigned long execution_time = millis() - start_time;
  
  // Publish acknowledgment
  if (success) {
    publish_acknowledgment(action_id, "success", execution_time);
  } else {
    publish_acknowledgment(action_id, "error", 0, "Unknown action");
  }
}

void publish_acknowledgment(String action_id, String status, unsigned long execution_time, String error = "") {
  String ack_topic = "smartfarm/devices/" + String(device_id) + "/ack";
  
  DynamicJsonDocument doc(512);
  doc["actionId"] = action_id;
  doc["status"] = status;
  doc["timestamp"] = get_timestamp();
  doc["deviceId"] = device_id;
  
  if (execution_time > 0) {
    doc["executionTime"] = execution_time;
  }
  
  if (error.length() > 0) {
    doc["error"] = error;
    doc["errorCode"] = "EXECUTION_ERROR";
  }
  
  String ack_message;
  serializeJson(doc, ack_message);
  
  if (client.publish(ack_topic.c_str(), ack_message.c_str())) {
    Serial.println("Published acknowledgment: " + status);
  } else {
    Serial.println("Failed to publish acknowledgment");
  }
}

void publish_status() {
  String status_topic = "smartfarm/devices/" + String(device_id) + "/status";
  
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = device_id;
  doc["status"] = "online";
  doc["timestamp"] = get_timestamp();
  doc["lastSeen"] = get_timestamp();
  doc["batteryLevel"] = get_battery_level();
  doc["signalStrength"] = WiFi.RSSI();
  
  JsonArray capabilities_array = doc.createNestedArray("capabilities");
  for (int i = 0; i < capabilityCount; i++) {
    capabilities_array.add(capabilities[i]);
  }
  
  String status_message;
  serializeJson(doc, status_message);
  
  if (client.publish(status_topic.c_str(), status_message.c_str())) {
    Serial.println("Published device status");
  } else {
    Serial.println("Failed to publish status");
  }
}

String get_timestamp() {
  // Return current timestamp in ISO format
  // You may need to implement proper time synchronization
  return "2025-01-10T08:45:00Z";
}

int get_battery_level() {
  // Implement battery level reading
  return 85; // Example: 85%
}

// Hardware pin definitions
#define FAN_PIN 2
#define IRRIGATION_PIN 3
#define HEATER_PIN 4
#define LIGHTS_PIN 5
```

---

## 🔧 **Testing & Validation**

### **Test Commands:**

1. **Test Fan Control:**
   ```bash
   mosquitto_pub -h 7.tcp.eu.ngrok.io -p 18025 -t "smartfarm/actuators/dht11h/fan_on" -m '{"actionId":"test_123","action":"fan_on"}'
   ```

2. **Test Irrigation:**
   ```bash
   mosquitto_pub -h 7.tcp.eu.ngrok.io -p 18025 -t "smartfarm/actuators/dht11h/irrigation_on" -m '{"actionId":"test_456","action":"irrigation_on"}'
   ```

### **Expected Acknowledgment:**
```bash
mosquitto_sub -h 7.tcp.eu.ngrok.io -p 18025 -t "smartfarm/devices/dht11h/ack"
```

---

## 📊 **Monitoring & Debugging**

### **MQTT Topics to Monitor:**
- `smartfarm/actuators/{device_id}/+` - Commands sent to device
- `smartfarm/devices/{device_id}/ack` - Device acknowledgments
- `smartfarm/devices/{device_id}/status` - Device status updates

### **Common Issues & Solutions:**

1. **Device not responding:**
   - Check MQTT connection
   - Verify topic subscriptions
   - Check device power and network

2. **Invalid JSON format:**
   - Validate JSON structure
   - Check timestamp format
   - Ensure required fields are present

3. **Action execution failures:**
   - Check hardware connections
   - Verify GPIO pin configurations
   - Monitor device logs

---

## 🚀 **Deployment Checklist**

- [ ] **MQTT Broker Connection**: Device connects to broker
- [ ] **Topic Subscription**: Device subscribes to command topics
- [ ] **Action Execution**: Device executes hardware actions
- [ ] **Acknowledgment Publishing**: Device publishes acknowledgments
- [ ] **Status Reporting**: Device publishes regular status updates
- [ ] **Error Handling**: Device handles and reports errors
- [ ] **Testing**: All actions tested and working
- [ ] **Monitoring**: Device status monitored in backend

---

## 📞 **Support & Contact**

For technical support or questions about this implementation:
- **Backend Team**: Smart Farm Backend Development
- **Documentation**: This implementation guide
- **MQTT Broker**: `7.tcp.eu.ngrok.io:18025`

---

**Version**: 1.0  
**Last Updated**: January 10, 2025  
**Status**: Production Ready ✅
