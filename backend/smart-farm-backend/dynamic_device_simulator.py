#!/usr/bin/env python3
"""
Dynamic Smart Farm IoT Device Simulator
Fetches real actions from the database and simulates device behavior accordingly.
"""

import json
import time
import random
import threading
import signal
import sys
import ssl
import os
import argparse
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from urllib.parse import urlparse
import requests

import paho.mqtt.client as mqtt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

class DynamicSmartFarmDeviceSimulator:
    """Dynamic Smart Farm IoT device simulator that fetches actions from the database"""
    
    def __init__(self, device_id: str, broker_url: str = None, username: str = None, password: str = None, backend_url: str = None):
        self.device_id = device_id
        self.broker_url = broker_url or os.environ.get('MQTT_BROKER')
        self.username = username or os.environ.get('MQTT_USERNAME')
        self.password = password or os.environ.get('MQTT_PASSWORD')
        self.backend_url = backend_url or os.environ.get('BACKEND_URL', 'http://localhost:3000/api')
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
        
        # Dynamic device state (will be populated from database)
        self.device_state = {}
        
        # Dynamic action handlers (will be populated from database)
        self.action_handlers = {}
        self.supported_actions = []
        
        # Simulation settings
        self.success_rate = 0.85  # 85% success rate
        self.execution_delay_range = (0.5, 3.0)  # 0.5-3 seconds
        self.heartbeat_interval = 1800  # 30 minutes (30 * 60 seconds)
        
        # Setup MQTT callbacks
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
    
    def parse_broker_url(self):
        """Parse broker URL to extract connection details"""
        parsed = urlparse(self.broker_url)
        self.broker_host = parsed.hostname
        self.broker_port = parsed.port or (8084 if parsed.scheme == 'wss' else 1883)
        self.use_ssl = parsed.scheme in ['wss', 'ssl']
    
    def fetch_device_actions(self) -> List[Dict[str, Any]]:
        """Fetch device actions from the backend API"""
        try:
            url = f"{self.backend_url}/devices/{self.device_id}/actions"
            logger.info(f"🔍 Fetching actions from: {url}")
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            actions = response.json()
            logger.info(f"✅ Fetched {len(actions)} actions from database")
            return actions
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Failed to fetch actions from backend: {e}")
            logger.warning("🔄 Falling back to basic actions...")
            return self.get_fallback_actions()
        except Exception as e:
            logger.error(f"❌ Unexpected error fetching actions: {e}")
            return self.get_fallback_actions()
    
    def get_fallback_actions(self) -> List[Dict[str, Any]]:
        """Fallback actions if database fetch fails"""
        return [
            {
                "id": "fallback_fan_on",
                "name": "Fan On",
                "actionUri": f"mqtt:smartfarm/actuators/{self.device_id}/fan_on",
                "actionType": "normal",
                "category": "ventilation"
            },
            {
                "id": "fallback_fan_off", 
                "name": "Fan Off",
                "actionUri": f"mqtt:smartfarm/actuators/{self.device_id}/fan_off",
                "actionType": "normal",
                "category": "ventilation"
            }
        ]
    
    def setup_dynamic_actions(self):
        """Setup device actions dynamically from database"""
        logger.info("🔄 Setting up dynamic actions from database...")
        
        # Fetch actions from database
        actions = self.fetch_device_actions()
        
        # Process each action
        for action in actions:
            try:
                action_uri = action.get('actionUri', '')
                if not action_uri.startswith('mqtt:'):
                    continue
                
                # Extract action name from URI
                # mqtt:smartfarm/actuators/dht11H/ventilator_on -> ventilator_on
                action_name = action_uri.split('/')[-1]
                
                if action_name:
                    self.supported_actions.append(action_name)
                    
                    # Create dynamic handler
                    self.action_handlers[action_name] = self.create_dynamic_handler(
                        action_name, 
                        action.get('name', action_name),
                        action.get('category', 'system'),
                        action.get('actionType', 'normal')
                    )
                    
                    # Initialize device state
                    state_key = self.get_state_key_from_action(action_name)
                    if state_key and state_key not in self.device_state:
                        self.device_state[state_key] = self.get_initial_state_value(action_name)
                    
                    logger.info(f"✅ Configured action: {action_name} ({action.get('actionType', 'normal')})")
                    
            except Exception as e:
                logger.error(f"❌ Error processing action {action}: {e}")
        
        logger.info(f"🎯 Configured {len(self.supported_actions)} dynamic actions")
        logger.info(f"📊 Device state initialized: {self.device_state}")
    
    def create_dynamic_handler(self, action_name: str, display_name: str, category: str, action_type: str):
        """Create a dynamic action handler"""
        def handler() -> Dict[str, Any]:
            try:
                logger.info(f"🔧 Executing {display_name} ({action_name})")
                
                # Simulate execution delay
                execution_time = random.uniform(0.1, 0.5)
                time.sleep(execution_time)
                
                # Get state key and determine action
                state_key = self.get_state_key_from_action(action_name)
                is_on_action = action_name.endswith('_on') or action_name in ['open_roof', 'calibrate', 'restart']
                
                if state_key:
                    current_state = self.device_state.get(state_key, False)
                    
                    # Check if action is valid
                    if is_on_action and current_state:
                        return {
                            "success": False,
                            "error": f"{display_name} is already running",
                            "errorCode": "ALREADY_ON"
                        }
                    elif not is_on_action and not current_state:
                        return {
                            "success": False,
                            "error": f"{display_name} is already off",
                            "errorCode": "ALREADY_OFF"
                        }
                    
                    # Update state
                    if state_key in ['roof']:
                        self.device_state[state_key] = "open" if is_on_action else "closed"
                    else:
                        self.device_state[state_key] = is_on_action
                
                # Special handling for specific actions
                if action_name == 'restart':
                    return self.handle_restart()
                elif action_name == 'calibrate':
                    return self.handle_calibrate()
                
                return {
                    "success": True,
                    "message": f"{display_name} executed successfully"
                }
                
            except Exception as e:
                logger.error(f"❌ Error executing {action_name}: {e}")
                return {
                    "success": False,
                    "error": f"Execution failed: {str(e)}",
                    "errorCode": "EXECUTION_ERROR"
                }
        
        return handler
    
    def get_state_key_from_action(self, action_name: str) -> str:
        """Get device state key from action name"""
        if 'ventilator' in action_name or 'fan' in action_name:
            return 'ventilator'
        elif 'humidifier' in action_name:
            return 'humidifier'
        elif 'water_pump' in action_name or 'irrigation' in action_name:
            return 'water_pump'
        elif 'light' in action_name:
            return 'lights'
        elif 'heater' in action_name:
            return 'heater'
        elif 'roof' in action_name:
            return 'roof'
        elif 'alarm' in action_name:
            return 'alarm'
        return None
    
    def get_initial_state_value(self, action_name: str):
        """Get initial state value for an action"""
        if 'roof' in action_name:
            return 'closed'
        return False
    
    def handle_restart(self) -> Dict[str, Any]:
        """Handle device restart"""
        logger.info("🔄 Simulating device restart...")
        time.sleep(2.0)  # Restart delay
        
        # Reset all states
        for key in self.device_state:
            if key == 'roof':
                self.device_state[key] = 'closed'
            else:
                self.device_state[key] = False
        
        return {"success": True, "message": "Device restarted successfully"}
    
    def handle_calibrate(self) -> Dict[str, Any]:
        """Handle sensor calibration"""
        logger.info("📏 Simulating sensor calibration...")
        time.sleep(3.0)  # Calibration takes time
        
        if random.random() < 0.9:  # 90% success rate
            return {"success": True, "message": "Sensors calibrated successfully"}
        else:
            return {
                "success": False,
                "error": "Calibration failed - sensor drift detected",
                "errorCode": "CALIBRATION_ERROR"
            }
    
    def on_connect(self, client, userdata, flags, rc):
        """Callback for MQTT connection"""
        if rc == 0:
            logger.info("🔌 Connected to MQTT broker successfully")
            self.subscribe_to_action_topics()
            self.publish_device_status("online")
        else:
            logger.error(f"❌ Failed to connect to MQTT broker: {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """Callback for MQTT disconnection"""
        if rc != 0:
            logger.warning(f"⚠️ Unexpected MQTT disconnection: {rc}")
        else:
            logger.info("🔌 Disconnected from MQTT broker")
    
    def on_message(self, client, userdata, msg):
        """Callback for MQTT message reception"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            
            logger.info(f"📨 Received message on {topic}")
            logger.debug(f"📋 Payload: {payload}")
            
            # Extract action from topic: smartfarm/actuators/dht11h/ventilator_on -> ventilator_on
            topic_parts = topic.split('/')
            if len(topic_parts) >= 4 and topic_parts[0] == 'smartfarm' and topic_parts[1] == 'actuators':
                action = topic_parts[3]
                self.process_action(action, payload)
            else:
                logger.warning(f"⚠️ Invalid topic format: {topic}")
                
        except Exception as e:
            logger.error(f"❌ Error processing message: {e}")
    
    def subscribe_to_action_topics(self):
        """Subscribe to action topics for this device"""
        base_topic = f"smartfarm/actuators/{self.device_id}"
        
        logger.info(f"🎯 Subscribing to actions for device: {self.device_id}")
        
        for action in self.supported_actions:
            topic = f"{base_topic}/{action}"
            self.client.subscribe(topic)
            logger.info(f"🎯 Subscribed to: {topic}")
        
        if not self.supported_actions:
            logger.warning("⚠️ No actions to subscribe to!")
    
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
                else:
                    # Send failure acknowledgment
                    self.send_acknowledgment(action_id, "error", {
                        "error": result["error"],
                        "errorCode": result.get("errorCode", "UNKNOWN_ERROR"),
                        "executionTime": round(time.time() - start_time, 2),
                        "action": action
                    })
            else:
                # Send failure acknowledgment
                error_msg = f"Action {action} not supported" if action not in self.action_handlers else "Simulated failure"
                self.send_acknowledgment(action_id, "error", {
                    "error": error_msg,
                    "errorCode": "ACTION_FAILED",
                    "executionTime": round(time.time() - start_time, 2),
                    "action": action
                })
                
        except Exception as e:
            logger.error(f"❌ Error executing action {action}: {e}")
            self.send_acknowledgment(action_id, "error", {
                "error": f"Execution error: {str(e)}",
                "errorCode": "EXECUTION_ERROR",
                "executionTime": round(time.time() - start_time, 2),
                "action": action
            })
    
    def send_acknowledgment(self, action_id: str, status: str, details: Dict[str, Any]):
        """Send action acknowledgment back to the backend"""
        ack_topic = f"smartfarm/devices/{self.device_id}/ack"
        
        ack_payload = {
            "actionId": action_id,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "deviceId": self.device_id,
            "action": details.get("action", "unknown"),
            **details
        }
        
        try:
            self.client.publish(ack_topic, json.dumps(ack_payload), qos=1, retain=False)
            logger.info(f"📤 Sent {status} acknowledgment for action {action_id}")
        except Exception as e:
            logger.error(f"❌ Failed to send acknowledgment: {e}")
    
    def publish_device_status(self, status: str = None):
        """Publish device status"""
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
            logger.info(f"🚀 Starting Dynamic Smart Farm Device Simulator")
            logger.info(f"📱 Device ID: {self.device_id}")
            logger.info(f"🌐 Broker: {self.broker_url}")
            logger.info(f"🔗 Backend: {self.backend_url}")
            logger.info(f"👤 Username: {self.username}")
            logger.info(f"📊 Success Rate: {self.success_rate*100}%")
            
            # Setup dynamic actions from database
            self.setup_dynamic_actions()
            
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


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Dynamic Smart Farm IoT Device Simulator')
    parser.add_argument('--device-id', '-d', default='dht11h', 
                       help='Device ID (default: dht11h)')
    parser.add_argument('--broker-url', '-b', default=None,
                       help='MQTT broker URL (default: MQTT_BROKER env var)')
    parser.add_argument('--backend-url', '-u', default='http://localhost:3000/api',
                       help='Backend API URL (default: http://localhost:3000/api)')
    parser.add_argument('--username', '-n', default=None,
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
    device = DynamicSmartFarmDeviceSimulator(
        device_id=args.device_id,
        broker_url=args.broker_url,
        backend_url=args.backend_url,
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
