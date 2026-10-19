# Backend — Setup Guide

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 22 (see `.nvmrc`) |
| npm | ≥ 10 |
| PostgreSQL | ≥ 14 |

---

## Environment Variables

Copy the example file and fill in every value:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | HTTP port (default: 3000) |
| `DATABASE_URL` | Yes | Full PostgreSQL connection URL |
| `DB_TYPE` | No | `postgres` (default) |
| `DB_HOST` | No | DB host (used when DATABASE_URL is not set) |
| `DB_PORT` | No | DB port (default: 5432) |
| `DB_USER` | No | DB username |
| `DB_PASS` | Yes | DB password |
| `DB_NAME` | No | DB name (default: sfdb) |
| `JWT_SECRET` | Yes | Long random string — generate with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | No | Token TTL (default: 24h) |
| `CORS_ORIGIN` | No | Allowed frontend origin |
| `MQTT_BROKER` | Yes | Full WSS URL, e.g. `wss://hostname:8084/mqtt` |
| `MQTT_USERNAME` | Yes | EMQX Cloud username |
| `MQTT_PASSWORD` | Yes | EMQX Cloud password |

---

## Database Setup

1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE sfdb;
   ```
2. Run the schema:
   ```bash
   psql -U postgres -d sfdb -f ../../docs/schema/sfdb_schema_only.sql
   ```
   The schema file (`sfdb_schema_only.sql`) contains DDL only — no personal data.
3. If you have the `.env` populated, you can also let TypeORM synchronize on first run (dev only):
   ```env
   DB_SYNCHRONIZE=true   # set to false in production
   ```

---

## Running Locally

```bash
# Install dependencies
npm install

# Development (watch mode with hot-reload)
npm run start:dev

# Build + production start
npm run build
npm run start:prod
```

The API is available at `http://localhost:3000/api/v1`.  
Health check: `GET http://localhost:3000/api/v1/health`

---

## Docker Compose

```bash
# From backend/smart-farm-backend/
cp .env.example .env   # fill in all values first
docker compose up --build
```

All secrets are read from the `.env` file — no values are hardcoded in `docker-compose.yml`.

---

## Simulator Tools

The `tools/` directory (root of the backend folder) contains development utilities:

| Tool | Description |
|------|-------------|
| `device_simulator.py` | Simulates an ESP32 device (actions + ack) |
| `dynamic_device_simulator.py` | Fetches actions from the DB, then simulates |
| `yl69_simulator.js` | Publishes soil moisture readings on MQTT |
| `test_mqtt_connection.js` | Verifies MQTT broker connectivity |
| `create-test-user.js` | Creates a user via the REST API |

All tools read MQTT credentials from the `.env` file (no hardcoded values).

```bash
# Python simulators
pip install -r requirements_simulator.txt
python device_simulator.py --device-id dht11H

# Node simulators (dotenv loaded automatically)
node yl69_simulator.js
node test_mqtt_connection.js
```

---

## Project Structure

```
src/
├── main.ts              ← NestJS bootstrap (CORS, Helmet, ValidationPipe)
├── app.module.ts        ← Root module (loads all feature modules)
├── config/
│   ├── typeorm.config.ts     ← TypeORM multi-DB connection factory
│   ├── mqtt.config.ts        ← MQTT config helper
│   └── production.config.ts  ← Env-driven production defaults
└── modules/
    ├── auth/            ← JWT auth, CSRF middleware
    ├── users/           ← User management
    ├── farms/           ← Farm management
    ├── devices/         ← Device registry
    ├── sensors/         ← Sensor CRUD
    ├── sensor-readings/ ← Time-series readings
    ├── mqtt/            ← MQTT broker connection + sensor ingestion
    ├── actions/         ← Actuator action log
    ├── notifications/   ← Alert notifications
    ├── crops/           ← Crop management
    └── health/          ← Health-check endpoint
```
