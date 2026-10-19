# MQTT Topics Reference

This document lists all MQTT topics used by the Smart Farm system.  
**No credentials are shown here** — see `.env.example` for connection settings.

---

## Broker

| Setting | Value |
|---------|-------|
| Protocol | WSS (WebSocket Secure, TLS) |
| Port | 8084 |
| Path | `/mqtt` |
| Host | Set via `MQTT_BROKER` env var |

---

## Topics Published by the ESP32-S3

| Topic | QoS | Payload format | Purpose |
|-------|-----|----------------|---------|
| `smartfarm/sensors/XY-MD02` | 1 | `{"temperature":22.5,"humidity":65,"device_id":"dht11H","ts":...}` | Air temperature & humidity from RS485/Modbus sensor |
| `smartfarm/sensors/YL-69` | 1 | `{"soil_moisture_percent":45,"soil_digital":0,"device_id":"...","ts":...}` | Soil moisture reading |
| `smartfarm/sensors/incident` | 1 | `{"error":"...","sensor":"XY-MD02","retries":3,"ts":...}` | Sensor read error |
| `smartfarm/devices/dht11H/status` | 1 (retain) | `{"status":"online","ts":...}` | Device heartbeat |
| `smartfarm/devices/dht11H/ack` | 1 | `{"actionId":"...","status":"success","executionTime":1.2}` | Actuator acknowledgment |

---

## Topics Subscribed by the ESP32-S3

| Topic | QoS | Payload format | Purpose |
|-------|-----|----------------|---------|
| `smartfarm/actuators/#` | 1 | `{"actionId":"...","command":"ventilator_on"}` | Actuator commands from backend |

### Actuator command subtopics

```
smartfarm/actuators/dht11H/ventilator_on
smartfarm/actuators/dht11H/ventilator_off
smartfarm/actuators/dht11H/humidifier_on
smartfarm/actuators/dht11H/open_roof
smartfarm/actuators/dht11H/water_pump_on
smartfarm/actuators/dht11H/light_on
```

---

## Topics Subscribed by the Backend

| Topic pattern | Purpose |
|---------------|---------|
| `smartfarm/sensors/+` | Receive sensor readings for storage & threshold evaluation |
| `smartfarm/devices/+/status` | Track device online/offline state |
| `smartfarm/devices/+/ack` | Receive actuator acknowledgments |

---

## Backup Mode

If the ESP32-S3 receives no MQTT heartbeat for **30 seconds**, it enters **backup mode**:
- Applies threshold logic locally (no MQTT required)
- Triggers actuators directly based on the control thresholds
- Exits backup mode when MQTT reconnects; all relays are reset
