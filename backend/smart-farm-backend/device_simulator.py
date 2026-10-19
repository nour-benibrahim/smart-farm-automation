#!/usr/bin/env python3
"""
🤖 Smart Farm IoT Device Simulator
==================================

This script simulates an IoT device (ESP32/Raspberry Pi) that:
1. Subscribes to MQTT action topics
2. Executes hardware actions (simulated)
3. Sends acknowledgments back to the backend
4. Publishes device status updates

Usage:
    python device_simulator.py --device-id dht11h --broker localhost --port 1883

Features:
- ✅ Realistic hardware simulation with execution delays
- ✅ Configurable success/failure rates for testing
- ✅ Proper MQTT acknowledgment protocol
- ✅ Device status heartbeat
- ✅ Error simulation for testing edge cases
- ✅ Logging and monitoring
"""

import json
import time
import random
import argparse
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import threading
import signal
import sys
import os

try:
    import paho.mqtt.client as mqtt
    import ssl
except ImportError:
    print("❌ Error: paho-mqtt not installed. Run: pip install paho-mqtt")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

class SmartFarmDeviceSimulator:
    """Simulates a Smart Farm IoT device with realistic behavior"""
    
    def __init__(self, device_id: str, broker_url: str = None, username: str = None, password: str = None):
        self.device_id = device_id
        self.broker_url = broker_url or os.environ.get('MQTT_BROKER')
        self.username = username or os.environ.get('MQTT_USERNAME')
        self.password = password or os.environ.get('MQTT_PASSWORD')
        if not self.broker_url or not self.username or not self.password:
            raise ValueError(
                'MQTT credentials required. Set MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD '
                'environment variables, or pass them as arguments.'
            )
        
        # Parse broker URL
        self.parse_broker_url()
        
        # Create MQTT client with WebSocket support
        self.client = mqtt.Client(transport="websockets")
        self.is_running = False
        self.device_status = "online"
        
        # Device capabilities and current state
        self.device_state = {
            "fan": False,
            "irrigation": False,
            "heater": False,
            "lights": False,
            "roof": "closed",  # closed/open
            "alarm": False,
            # New actuators from your sensors table
            "ventilator": False,
            "humidifier": False,
            "water_pump": False
        }
        
        # Simulation settings
        self.success_rate = 0.85  # 85% success rate
        self.execution_delay_range = (0.5, 3.0)  # 0.5-3 seconds
        self.heartbeat_interval = 1800  # 30 minutes (30 * 60 seconds)
        
        # Action mapping - only your real actions from sensors table
        self.action_handlers = {
            # Your real actions from sensors table
            "ventilator_off": self.handle_ventilator_off,
            "ventilator_on": self.handle_ventilator_on,
            "humidifier_on": self.handle_humidifier_on,
            "open_roof": self.handle_open_roof,
            "water_pump_on": self.handle_water_pump_on,
            "light_on": self.handle_light_on,
            # Keep basic actions for testing
            "restart": self.handle_restart,
            "calibrate": self.handle_calibrate
        }
        
        # Setup MQTT callbacks
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        # Setup graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
    
    def parse_broker_url(self):
        """Parse the broker URL to extract host, port, and protocol"""
        import urllib.parse
        
        parsed = urllib.parse.urlparse(self.broker_url)
        self.broker_host = parsed.hostname
        self.broker_port = parsed.port
        self.use_ssl = parsed.scheme in ['wss', 'ssl', 'mqtts']
        
        logger.info(f"🔗 Parsed broker: {self.broker_host}:{self.broker_port} (SSL: {self.use_ssl})")
    
    def on_connect(self, client, userdata, flags, rc):
        """Callback for when the client receives a CONNACK response from the server"""
        if rc == 0:
            logger.info(f"🔗 Device {self.device_id} connected to MQTT broker")
            self.subscribe_to_action_topics()
            self.publish_device_status("online")
        else:
            logger.error(f"❌ Failed to connect to MQTT broker. Return code: {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """Callback for when the client disconnects from the server"""
        logger.warning(f"🔌 Device {self.device_id} disconnected from MQTT broker")
    
    def on_message(self, client, userdata, msg):
        """Callback for when a PUBLISH message is received from the server"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            
            logger.info(f"📨 Received action on {topic}: {payload}")
            
            # Parse the action from topic
            # Topic format: smartfarm/actuators/{device_id}/{action}
            topic_parts = topic.split('/')
            if len(topic_parts) >= 4 and topic_parts[0] == 'smartfarm' and topic_parts[1] == 'actuators':
                action = topic_parts[3]
                self.process_action(action, payload)
            else:
                logger.warning(f"⚠️ Unknown topic format: {topic}")
                
        except Exception as e:
            logger.error(f"❌ Error processing message: {e}")
    
    def subscribe_to_action_topics(self):
        """Subscribe to all action topics for this device"""
        base_topic = f"smartfarm/actuators/{self.device_id}"
        
        # Subscribe to your real actions from sensors table
        actions = [
            # Your real actions from sensors table
            "ventilator_off",    # temperature low
            "ventilator_on",     # temperature high  
            "humidifier_on",     # humidity low
            "open_roof",         # humidity high
            "water_pump_on",     # soil humidity low
            "light_on",          # light low
            # Keep some basic actions for testing
            "restart", "calibrate"
        ]
        
        for action in actions:
            topic = f"{base_topic}/{action}"
            self.client.subscribe(topic)
            logger.info(f"🎯 Subscribed to: {topic}")
    
    def process_action(self, action: str, payload_str: str):
        """Process incoming action request"""
        try:
            # Parse payload
            payload = json.loads(payload_str)
            action_id = payload.get('actionId', 'unknown')
            
            logger.info(f"🔧 Processing action: {action} (ID: {action_id})")
            logger.info(f"📋 Action payload: {payload_str}")
            
            # Execute action in a separate thread to avoid blocking
            threading.Thread(
                target=self.execute_action,
                args=(action, action_id, payload),
                daemon=True
            ).start()
            
        except json.JSONDecodeError:
            logger.error(f"❌ Invalid JSON payload: {payload_str}")
        except Exception as e:
            logger.error(f"❌ Error processing action: {e}")
    
    def execute_action(self, action: str, action_id: str, payload: Dict[str, Any]):
        """Execute the hardware action (simulated)"""
        start_time = time.time()
        
        try:
            # Simulate execution delay
            execution_time = random.uniform(*self.execution_delay_range)
            time.sleep(execution_time)
            
            # Simulate success/failure
            success = random.random() < self.success_rate
            
            if success and action in self.action_handlers:
                # Execute the action handler
                result = self.action_handlers[action]()
                
                if result["success"]:
                    # Send success acknowledgment
                    self.send_acknowledgment(action_id, "success", {
                        "message": result["message"],
                        "executionTime": round(time.time() - start_time, 2),
                        "action": action,
                        "deviceState": self.device_state.copy()
                    })
                    logger.info(f"✅ Action {action} completed successfully")
                else:
                    # Send failure acknowledgment
                    self.send_acknowledgment(action_id, "error", {
                        "error": result["error"],
                        "errorCode": result.get("errorCode", "EXECUTION_ERROR"),
                        "action": action
                    })
                    logger.error(f"❌ Action {action} failed: {result['error']}")
            else:
                # Simulate random failure
                error_messages = [
                    "Hardware component not responding",
                    "GPIO pin malfunction",
                    "Power supply insufficient",
                    "Sensor calibration required",
                    "Communication timeout with actuator"
                ]
                
                self.send_acknowledgment(action_id, "error", {
                    "error": random.choice(error_messages),
                    "errorCode": "HARDWARE_ERROR",
                    "action": action
                })
                logger.error(f"❌ Action {action} failed (simulated failure)")
                
        except Exception as e:
            # Send error acknowledgment
            self.send_acknowledgment(action_id, "error", {
                "error": f"Unexpected error: {str(e)}",
                "errorCode": "SYSTEM_ERROR",
                "action": action
            })
            logger.error(f"❌ Unexpected error executing {action}: {e}")
    
    def send_acknowledgment(self, action_id: str, status: str, data: Dict[str, Any]):
        """Send acknowledgment back to the backend"""
        ack_topic = f"smartfarm/devices/{self.device_id}/ack"
        
        ack_payload = {
            "actionId": action_id,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "deviceId": self.device_id,
            **data
        }
        
        try:
            self.client.publish(ack_topic, json.dumps(ack_payload), qos=1)
            logger.info(f"📤 Sent {status} acknowledgment for action {action_id}")
        except Exception as e:
            logger.error(f"❌ Failed to send acknowledgment: {e}")
    
    def publish_device_status(self, status: str = None):
        """Publish device status/heartbeat"""
        if status:
            self.device_status = status
            
        status_topic = f"smartfarm/devices/{self.device_id}/status"
        
        status_payload = {
            "deviceId": self.device_id,
            "status": self.device_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "lastSeen": datetime.now(timezone.utc).isoformat(),
            "capabilities": list(self.action_handlers.keys()),
            "deviceState": self.device_state.copy(),
            "uptime": time.time() - getattr(self, 'start_time', time.time())
        }
        
        try:
            self.client.publish(status_topic, json.dumps(status_payload), qos=1, retain=True)
            logger.debug(f"📊 Published device status: {self.device_status}")
        except Exception as e:
            logger.error(f"❌ Failed to publish device status: {e}")
    
    def start_heartbeat(self):
        """Start periodic heartbeat/status updates"""
        def heartbeat_loop():
            while self.is_running:
                self.publish_device_status()
                time.sleep(self.heartbeat_interval)
        
        threading.Thread(target=heartbeat_loop, daemon=True).start()
        logger.info(f"💓 Started heartbeat every {self.heartbeat_interval} seconds")
    
    def start(self):
        """Start the device simulator"""
        try:
            logger.info(f"🚀 Starting Smart Farm Device Simulator")
            logger.info(f"📱 Device ID: {self.device_id}")
            logger.info(f"🌐 Broker: {self.broker_url}")
            logger.info(f"👤 Username: {self.username}")
            logger.info(f"📊 Success Rate: {self.success_rate*100}%")
            logger.info(f"⚙️  Supported Actions: {len(self.action_handlers)} actions")
            
            # Show your real actions from sensors table
            logger.info(f"🎯 Subscribed to your real sensor actions:")
            logger.info(f"📊 Temperature: ventilator_off (low) / ventilator_on (high)")
            logger.info(f"💧 Humidity: humidifier_on (low) / open_roof (high)")
            logger.info(f"🌱 Soil: water_pump_on (low)")
            logger.info(f"💡 Light: light_on (low)")
            logger.info(f"⚙️  Total actions: {len(self.action_handlers)}")
            
            self.start_time = time.time()
            self.is_running = True
            
            # Set up authentication
            if self.username and self.password:
                self.client.username_pw_set(self.username, self.password)
                logger.info(f"🔐 Authentication configured")
            
            # Set up SSL/TLS for WSS connections
            if self.use_ssl:
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                self.client.tls_set_context(context)
                logger.info(f"🔒 SSL/TLS configured for secure connection")
            
            # Connect to MQTT broker
            logger.info(f"🔌 Connecting to {self.broker_host}:{self.broker_port}...")
            self.client.connect(self.broker_host, self.broker_port, 60)
            
            # Start heartbeat
            self.start_heartbeat()
            
            # Start MQTT loop
            self.client.loop_forever()
            
        except Exception as e:
            logger.error(f"❌ Failed to start device simulator: {e}")
            self.stop()
    
    def stop(self):
        """Stop the device simulator"""
        logger.info(f"🛑 Stopping device simulator...")
        self.is_running = False
        
        # Publish offline status
        self.publish_device_status("offline")
        time.sleep(1)  # Give time for message to be sent
        
        # Disconnect from MQTT
        self.client.disconnect()
        logger.info(f"✅ Device simulator stopped")
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"📡 Received signal {signum}, shutting down...")
        self.stop()
        sys.exit(0)
    
    # =============================================================================
    # ACTION HANDLERS - Simulate actual hardware operations
    # =============================================================================
    
    def handle_fan_on(self) -> Dict[str, Any]:
        """Simulate turning fan on"""
        if self.device_state["fan"]:
            return {"success": False, "error": "Fan is already running", "errorCode": "ALREADY_ON"}
        
        # Simulate GPIO control
        time.sleep(0.1)  # GPIO switching delay
        self.device_state["fan"] = True
        return {"success": True, "message": "Fan turned on successfully"}
    
    def handle_fan_off(self) -> Dict[str, Any]:
        """Simulate turning fan off"""
        if not self.device_state["fan"]:
            return {"success": False, "error": "Fan is already off", "errorCode": "ALREADY_OFF"}
        
        time.sleep(0.1)
        self.device_state["fan"] = False
        return {"success": True, "message": "Fan turned off successfully"}
    
    def handle_irrigation_on(self) -> Dict[str, Any]:
        """Simulate turning irrigation on"""
        if self.device_state["irrigation"]:
            return {"success": False, "error": "Irrigation is already running", "errorCode": "ALREADY_ON"}
        
        # Simulate water pump startup
        time.sleep(0.5)  # Pump startup delay
        self.device_state["irrigation"] = True
        return {"success": True, "message": "Irrigation system activated"}
    
    def handle_irrigation_off(self) -> Dict[str, Any]:
        """Simulate turning irrigation off"""
        if not self.device_state["irrigation"]:
            return {"success": False, "error": "Irrigation is already off", "errorCode": "ALREADY_OFF"}
        
        time.sleep(0.3)
        self.device_state["irrigation"] = False
        return {"success": True, "message": "Irrigation system deactivated"}
    
    def handle_heater_on(self) -> Dict[str, Any]:
        """Simulate turning heater on"""
        if self.device_state["heater"]:
            return {"success": False, "error": "Heater is already on", "errorCode": "ALREADY_ON"}
        
        time.sleep(0.2)
        self.device_state["heater"] = True
        return {"success": True, "message": "Heater activated"}
    
    def handle_heater_off(self) -> Dict[str, Any]:
        """Simulate turning heater off"""
        if not self.device_state["heater"]:
            return {"success": False, "error": "Heater is already off", "errorCode": "ALREADY_OFF"}
        
        time.sleep(0.2)
        self.device_state["heater"] = False
        return {"success": True, "message": "Heater deactivated"}
    
    def handle_lights_on(self) -> Dict[str, Any]:
        """Simulate turning lights on"""
        if self.device_state["lights"]:
            return {"success": False, "error": "Lights are already on", "errorCode": "ALREADY_ON"}
        
        time.sleep(0.1)
        self.device_state["lights"] = True
        return {"success": True, "message": "Lights turned on"}
    
    def handle_lights_off(self) -> Dict[str, Any]:
        """Simulate turning lights off"""
        if not self.device_state["lights"]:
            return {"success": False, "error": "Lights are already off", "errorCode": "ALREADY_OFF"}
        
        time.sleep(0.1)
        self.device_state["lights"] = False
        return {"success": True, "message": "Lights turned off"}
    
    def handle_open_roof(self) -> Dict[str, Any]:
        """Simulate opening roof"""
        if self.device_state["roof"] == "open":
            return {"success": False, "error": "Roof is already open", "errorCode": "ALREADY_OPEN"}
        
        # Simulate motor operation
        time.sleep(2.0)  # Roof opening takes time
        self.device_state["roof"] = "open"
        return {"success": True, "message": "Roof opened successfully"}
    
    def handle_close_roof(self) -> Dict[str, Any]:
        """Simulate closing roof"""
        if self.device_state["roof"] == "closed":
            return {"success": False, "error": "Roof is already closed", "errorCode": "ALREADY_CLOSED"}
        
        time.sleep(2.0)
        self.device_state["roof"] = "closed"
        return {"success": True, "message": "Roof closed successfully"}
    
    def handle_alarm_on(self) -> Dict[str, Any]:
        """Simulate turning alarm on"""
        if self.device_state["alarm"]:
            return {"success": False, "error": "Alarm is already active", "errorCode": "ALREADY_ON"}
        
        time.sleep(0.1)
        self.device_state["alarm"] = True
        return {"success": True, "message": "Alarm activated"}
    
    def handle_alarm_off(self) -> Dict[str, Any]:
        """Simulate turning alarm off"""
        if not self.device_state["alarm"]:
            return {"success": False, "error": "Alarm is already off", "errorCode": "ALREADY_OFF"}
        
        time.sleep(0.1)
        self.device_state["alarm"] = False
        return {"success": True, "message": "Alarm deactivated"}
    
    def handle_restart(self) -> Dict[str, Any]:
        """Simulate device restart"""
        logger.info("🔄 Simulating device restart...")
        
        # Simulate restart sequence
        time.sleep(1.0)  # Shutdown delay
        
        # Reset all states
        self.device_state = {
            "fan": False,
            "irrigation": False,
            "heater": False,
            "lights": False,
            "roof": "closed",
            "alarm": False,
            # New actuators from your sensors table
            "ventilator": False,
            "humidifier": False,
            "water_pump": False
        }
        
        time.sleep(2.0)  # Boot delay
        return {"success": True, "message": "Device restarted successfully"}
    
    def handle_calibrate(self) -> Dict[str, Any]:
        """Simulate sensor calibration"""
        logger.info("📏 Simulating sensor calibration...")
        
        # Simulate calibration process
        time.sleep(3.0)  # Calibration takes time
        
        # Random calibration success/failure
        if random.random() < 0.9:  # 90% success rate for calibration
            return {"success": True, "message": "Sensors calibrated successfully"}
        else:
            return {
                "success": False, 
                "error": "Calibration failed - sensor drift detected",
                "errorCode": "CALIBRATION_ERROR"
            }
    
    # =============================================================================
    # NEW ACTION HANDLERS - Based on your sensors table
    # =============================================================================
    
    def handle_ventilator_on(self) -> Dict[str, Any]:
        """Simulate turning ventilator on (temperature control)"""
        if self.device_state.get("ventilator", False):
            return {"success": False, "error": "Ventilator is already running", "errorCode": "ALREADY_ON"}
        
        logger.info("🌪️ Turning ventilator ON for temperature control...")
        time.sleep(0.2)  # Simulate motor startup
        self.device_state["ventilator"] = True
        return {"success": True, "message": "Ventilator turned on successfully"}
    
    def handle_ventilator_off(self) -> Dict[str, Any]:
        """Simulate turning ventilator off"""
        if not self.device_state.get("ventilator", False):
            return {"success": False, "error": "Ventilator is already off", "errorCode": "ALREADY_OFF"}
        
        logger.info("🌪️ Turning ventilator OFF...")
        time.sleep(0.1)
        self.device_state["ventilator"] = False
        return {"success": True, "message": "Ventilator turned off successfully"}
    
    def handle_humidifier_on(self) -> Dict[str, Any]:
        """Simulate turning humidifier on (humidity control)"""
        if self.device_state.get("humidifier", False):
            return {"success": False, "error": "Humidifier is already running", "errorCode": "ALREADY_ON"}
        
        logger.info("💨 Turning humidifier ON for humidity control...")
        time.sleep(0.3)  # Simulate water pump startup
        self.device_state["humidifier"] = True
        return {"success": True, "message": "Humidifier turned on successfully"}
    
    def handle_water_pump_on(self) -> Dict[str, Any]:
        """Simulate turning water pump on (soil irrigation)"""
        if self.device_state.get("water_pump", False):
            return {"success": False, "error": "Water pump is already running", "errorCode": "ALREADY_ON"}
        
        logger.info("💧 Turning water pump ON for soil irrigation...")
        time.sleep(0.5)  # Simulate pump startup and pressure build
        self.device_state["water_pump"] = True
        return {"success": True, "message": "Water pump turned on successfully"}
    
    def handle_light_on(self) -> Dict[str, Any]:
        """Simulate turning lights on (light supplementation)"""
        if self.device_state.get("lights", False):
            return {"success": False, "error": "Lights are already on", "errorCode": "ALREADY_ON"}
        
        logger.info("💡 Turning lights ON for supplemental lighting...")
        time.sleep(0.1)  # LED startup is instant
        self.device_state["lights"] = True
        return {"success": True, "message": "Lights turned on successfully"}


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Smart Farm IoT Device Simulator')
    parser.add_argument('--device-id', '-d', default='dht11h', 
                       help='Device ID (default: dht11h)')
    parser.add_argument('--broker-url', '-b', default=None,
                       help='MQTT broker URL (default: MQTT_BROKER env var)')
    parser.add_argument('--username', '-u', default=None,
                       help='MQTT username (default: MQTT_USERNAME env var)')
    parser.add_argument('--password', '-p', default=None,
                       help='MQTT password (default: MQTT_PASSWORD env var)')
    parser.add_argument('--success-rate', '-s', type=float, default=0.85,
                       help='Action success rate 0.0-1.0 (default: 0.85)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create and start device simulator
    device = SmartFarmDeviceSimulator(
        device_id=args.device_id,
        broker_url=args.broker_url,
        username=args.username,
        password=args.password
    )
    
    # Set success rate
    device.success_rate = max(0.0, min(1.0, args.success_rate))
    
    try:
        device.start()
    except KeyboardInterrupt:
        logger.info("👋 Goodbye!")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
