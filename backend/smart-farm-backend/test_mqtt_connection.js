#!/usr/bin/env node
/**
 * Quick MQTT Connection Test
 * Tests if the backend can connect to the same MQTT broker as the device simulator
 */

const mqtt = require('mqtt');

// Load credentials from .env file (copy .env.example to .env first)
require('dotenv').config();

const MQTT_BROKER   = process.env.MQTT_BROKER;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

if (!MQTT_BROKER || !MQTT_USERNAME || !MQTT_PASSWORD) {
  console.error('❌ Missing env vars: MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD');
  console.error('   Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

console.log('🧪 Testing MQTT Connection...');
console.log(`📡 Broker: ${MQTT_BROKER}`);
console.log(`👤 Username: ${MQTT_USERNAME}`);

const client = mqtt.connect(MQTT_BROKER, {
  clientId: `test_client_${Math.random().toString(16).substr(2, 8)}`,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  keepalive: 60,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  clean: true,
  rejectUnauthorized: false,
  protocol: 'wss',
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker successfully!');
  
  // Subscribe to acknowledgment topics
  client.subscribe('smartfarm/devices/+/ack', (err) => {
    if (err) {
      console.error('❌ Failed to subscribe to ack topics:', err);
    } else {
      console.log('📡 Successfully subscribed to smartfarm/devices/+/ack');
    }
  });
  
  // Subscribe to status topics
  client.subscribe('smartfarm/devices/+/status', (err) => {
    if (err) {
      console.error('❌ Failed to subscribe to status topics:', err);
    } else {
      console.log('📡 Successfully subscribed to smartfarm/devices/+/status');
    }
  });
  
  console.log('🎯 Listening for device messages...');
  console.log('💡 Execute an action from the dashboard to test!');
});

client.on('message', (topic, payload) => {
  console.log(`📨 Message received on ${topic}:`);
  console.log(`📦 Payload: ${payload.toString()}`);
  
  try {
    const parsed = JSON.parse(payload.toString());
    console.log(`🔍 Parsed JSON:`, parsed);
    
    if (topic.includes('/ack')) {
      console.log(`🎯 This is an acknowledgment message!`);
      console.log(`   Action ID: ${parsed.actionId}`);
      console.log(`   Status: ${parsed.status}`);
      console.log(`   Device ID: ${parsed.deviceId}`);
    }
  } catch (e) {
    console.log(`⚠️ Could not parse as JSON`);
  }
  
  console.log('---');
});

client.on('error', (error) => {
  console.error('❌ MQTT Error:', error.message);
});

client.on('close', () => {
  console.log('🔌 MQTT connection closed');
});

client.on('offline', () => {
  console.log('📴 MQTT client went offline');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  client.end();
  process.exit(0);
});

// Keep the script running
console.log('🔄 Press Ctrl+C to stop');
