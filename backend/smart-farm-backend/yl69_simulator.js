#!/usr/bin/env node
/**
 * YL-69 soil-moisture sensor MQTT simulator
 * ------------------------------------------------------------------
 * Simulates the ESP32 firmware payload on the exact topic the backend
 * listens to, so the tester can verify ingestion, thresholds and
 * notifications without the physical sensor.
 *
 * Payload format (identical to the firmware):
 *   {"device_id":"ESP32-9FC114","soil_moisture_percent":45,"soil_digital":0,"ts":...}
 *
 * Usage (run from smart-farm-backend/):
 *   node yl69_simulator.js                            # continuous mode, 5s interval
 *   node yl69_simulator.js --value 45                 # send one value once and exit
 *   node yl69_simulator.js --value 85 --interval 2    # send 85% every 2 seconds
 *   node yl69_simulator.js --once                     # one-shot with first cycle value
 *
 * Requires the mqtt package (already present in smart-farm-backend/node_modules).
 * On a machine without this repo:  npm install mqtt   in any folder first.
 */

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

// Load credentials from .env file (copy .env.example to .env first)
require('dotenv').config();
const BROKER_URL = process.env.MQTT_BROKER;
const USERNAME   = process.env.MQTT_USERNAME;
const PASSWORD   = process.env.MQTT_PASSWORD;
if (!BROKER_URL || !USERNAME || !PASSWORD) {
  console.error('❌ Missing env vars: MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD');
  console.error('   Copy .env.example to .env and fill in the values.');
  process.exit(1);
}
const TOPIC = 'smartfarm/sensors/YL-69';
const DEVICE_ID = 'ESP32-9FC114';
const CA_CERT_PATH = path.join(__dirname, '..', 'certs', 'emqxsl-ca.crt');

// Verify the broker's TLS certificate against the EMQX CA shipped with the repo.
// Only falls back to unverified TLS if the CA file is missing (test-only convenience).
let tlsOptions;
try {
  tlsOptions = { ca: fs.readFileSync(CA_CERT_PATH) };
  console.log(`🔒 TLS verified with CA: ${CA_CERT_PATH}`);
} catch {
  tlsOptions = { rejectUnauthorized: false };
  console.warn(`⚠️ CA not found at ${CA_CERT_PATH} - using unverified TLS (test-only)`);
}

// --- CLI arguments ---
function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : null;
}
const once = process.argv.includes('--once') || process.argv.includes('-o');
const interval = Math.max(1, parseFloat(getArg('--interval') || '5'));
const oneValue = getArg('--value');

// Continuous-mode moisture cycle (%):
// stays normal, dips below 20 (WARNING LOW) and peaks at 100 (CRITICAL HIGH)
// so every threshold path is exercised over time.
const CYCLE = [48, 35, 25, 18, 22, 40, 55, 65, 85, 100, 60, 30];
let step = 0;

function buildPayload(percent) {
  const soilDigital = percent < 30 ? 1 : 0; // emulate YL-69 digital threshold output
  return JSON.stringify({
    device_id: DEVICE_ID,
    soil_moisture_percent: Math.round(percent),
    soil_digital: soilDigital,
    ts: Date.now(),
  });
}

function send(percent) {
  if (isNaN(percent) || percent < 0 || percent > 100) {
    console.error(`❌ Invalid value: ${percent}. Must be a number between 0 and 100.`);
    process.exit(1);
  }
  const payload = buildPayload(percent);
  client.publish(TOPIC, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Publish error:`, err.message);
    } else {
      console.log(`📤 Sent: ${payload}`);
    }
  });
  if (oneValue !== null || once) {
    setTimeout(() => {
      client.end();
      process.exit(0);
    }, 1500);
  }
}

const client = mqtt.connect(BROKER_URL, {
  clientId: `yl69_sim_${Math.random().toString(16).slice(2, 8)}`,
  username: USERNAME,
  password: PASSWORD,
  reconnectPeriod: 3000,
  ...tlsOptions,
});

client.on('connect', () => {
  console.log(`✅ Connected to broker`);
  console.log(`📡 Topic: ${TOPIC}`);

  if (oneValue !== null) {
    send(parseFloat(oneValue));
  } else if (once) {
    send(CYCLE[0]);
  } else {
    send(CYCLE[0]);
    setInterval(() => {
      step = (step + 1) % CYCLE.length;
      send(CYCLE[step]);
    }, interval * 1000);
    console.log(`🔄 Continuous mode: next value every ${interval}s (Ctrl+C to stop)`);
  }
});

client.on('error', (err) => console.error(`❌ MQTT error:`, err.message));
client.on('reconnect', () => console.log('🔄 Reconnecting...'));
