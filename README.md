# 🌱 Smart Farm Automation System

A full-stack IoT greenhouse monitoring and control system built during an internship at **FEED IN GREEN**.  
It combines an **ESP32-S3 embedded controller** with a **NestJS cloud backend**, communicating over **MQTT via WebSocket Secure (WSS)**.

---

## Architecture Overview

```
                ┌──────────────┐        WSS/MQTT        ┌────────────────────┐
                │  ESP32-S3    │ ══════════════════════> │  EMQX Cloud Broker │
                │  Firmware    │ <══════════════════════ │  (wss://:8084)     │
                └──────┬───────┘                         └─────────┬──────────┘
                       │                                           │
          ┌────────────┼────────────┐                   ┌─────────▼──────────┐
          │            │            │                   │   NestJS Backend   │
    XY-MD02        YL-69       Relay board              │   (Node.js v22)    │
  (RS485/Modbus)  (soil ADC)  (ventilator,              │   PostgreSQL DB    │
  temp + humidity             humidifier,               │   Socket.IO        │
                              water pump,               └────────────────────┘
                              lights, roof)
```

| Component | Technology |
|-----------|-----------|
| Firmware | Arduino / ESP32-S3, FreeRTOS (dual-core), PubSubClient, WebSockets |
| Backend | NestJS v11, TypeORM, PostgreSQL, JWT auth, Socket.IO |
| Broker | EMQX Cloud (MQTT over WSS, port 8084) |
| Sensors | XY-MD02 (RS485/Modbus), YL-69 (analog ADC) |
| Actuators | 8-relay board (ventilator, humidifier, water pump, lights, roof, spares) |

---

## Repository Structure

```
smart-farm-publication/
├── .gitignore                      ← root gitignore (covers secrets, archives, PDF)
├── README.md                       ← this file
├── docs/
│   ├── architecture.md             ← detailed system design
│   ├── MQTT_topics.md              ← topic reference
│   ├── firmware_setup.md           ← flashing instructions
│   ├── backend_setup.md            ← backend setup guide
│   └── schema/
│       └── sfdb_schema_only.sql    ← DDL-only schema (no personal data)
├── firmware/
│   ├── README.md                   ← library list, pin map, flash steps
│   ├── smart_farm_wss_db_aligned.ino ← ESP32-S3 firmware
│   └── secrets.h.example           ← credential template (copy to secrets.h)
└── backend/
    └── smart-farm-backend/         ← NestJS application
        ├── .env.example            ← environment variable template
        ├── README.md               ← backend-specific setup
        └── src/                    ← NestJS source
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 22 (see `.nvmrc`)
- **PostgreSQL** ≥ 14
- **EMQX Cloud** account (free tier is sufficient)
- **Arduino IDE** ≥ 2.x with ESP32-S3 board support

### Backend

```bash
cd backend/smart-farm-backend
cp .env.example .env          # fill in your credentials
npm install
npm run start:dev
```

See [`backend/smart-farm-backend/README.md`](backend/smart-farm-backend/README.md) for the full setup.

### Firmware

1. Copy `firmware/secrets.h.example` → `firmware/secrets.h`
2. Fill in your Wi-Fi and MQTT credentials in `secrets.h`
3. Install the required libraries (see `firmware/README.md`)
4. Flash to your ESP32-S3

---

## Environment Variables

Copy `.env.example` to `.env` — it lists every required variable with descriptions.

> ⚠️ **Never commit `.env` or `secrets.h`** — both are in `.gitignore`.

---

## MQTT Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `smartfarm/sensors/XY-MD02` | ESP32 → broker | Air temperature + humidity |
| `smartfarm/sensors/YL-69` | ESP32 → broker | Soil moisture |
| `smartfarm/sensors/incident` | ESP32 → broker | Sensor error reports |
| `smartfarm/devices/dht11H/status` | ESP32 → broker | Heartbeat / online-offline |
| `smartfarm/devices/dht11H/ack` | ESP32 → broker | Actuator acknowledgment |
| `smartfarm/actuators/#` | broker → ESP32 | Actuator commands |

---

## Control Thresholds

| Sensor | Low threshold | Action | High threshold | Action |
|--------|--------------|--------|---------------|--------|
| Temperature | < 17 °C | `ventilator_off` | > 28 °C | `ventilator_on` |
| Humidity | < 62 % | `humidifier_on` | > 73 % | `open_roof` (pulse 2.5 s) |
| Soil moisture | < 20 % | `water_pump_on` | > 80 % | safety cutoff |

The firmware enters **backup mode** after 30 s without a heartbeat and applies these thresholds autonomously.

---

## Security Notes

- Credentials are **never hardcoded** in source files — they live in `.env` (backend) and `secrets.h` (firmware), both gitignored.
- The MQTT connection uses **WSS (TLS)** on port 8084.
- The backend uses **Helmet**, **ThrottleGuard** (20 req/min), and **CSRF** middleware.
- JWT tokens are stored in **HttpOnly cookies**.

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes.  
See [`CONTRIBUTING.md`](CONTRIBUTING.md) if present.

---

## License

Contact the author before reuse. A license file will be added before the first stable release.
