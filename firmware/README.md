# Firmware — Setup Guide

## Required Libraries

Install these libraries via **Arduino IDE → Library Manager** (or PlatformIO):

| Library | Version (tested) | Author |
|---------|----------------|--------|
| WebSockets | ≥ 2.4.0 | Markus Sattler |
| PubSubClient | ≥ 2.8.0 | Nick O'Leary |
| ModbusMaster | ≥ 2.0.1 | Doc Walker |

> The ESP32-S3 board package from **Espressif** must also be installed (`esp32` by Espressif Systems, tested on ≥ 3.x).

---

## Hardware Configuration

### Board
- **ESP32-S3** (tested with ESP32-S3 DevKitC-1)
- Partition scheme: **Default 4MB with spiffs** or larger

### Pin Map

| Signal | GPIO | Notes |
|--------|------|-------|
| RS485 TX (XY-MD02) | 17 | UART2 TX |
| RS485 RX (XY-MD02) | 18 | UART2 RX |
| RS485 DE/RE | — | Module handles direction automatically |
| YL-69 analog | 8 | ADC input |
| YL-69 digital | 9 | Digital threshold output |
| Relay 1 — ventilator | 4 | |
| Relay 2 — humidifier | 5 | |
| Relay 3 — water pump | 6 | |
| Relay 4 — light | 7 | |
| Relay 5 — roof | 15 | |
| Relay 6 — spare | 16 | |
| Relay 7 — spare | 3 | ⚠️ Strapping pin — avoid if possible |
| Relay 8 — spare | 10 | |
| LED green | 13 | WiFi / MQTT connected |
| LED red | 14 | Error / backup mode |

> ⚠️ GPIO 3 is a boot-mode strapping pin on the ESP32-S3. If relay 7 is used, verify it does not interfere with boot.

---

## Credential Setup

1. **Copy** `firmware/secrets.h.example` to `firmware/secrets.h`
2. **Edit** `secrets.h` and fill in:
   - `WIFI_SSID` / `WIFI_PASSWORD` — your Wi-Fi network
   - `MQTT_BROKER_HOST`, `MQTT_BROKER_PORT`, `MQTT_WS_PATH` — from your EMQX Cloud dashboard
   - `MQTT_USER` / `MQTT_PASS` — EMQX Cloud credentials
   - (Optional) `EMQX_CA_CERT_PEM` — paste the CA certificate when `USE_CA_CERT 1`

> `secrets.h` is listed in `.gitignore` and will **never** be committed.

---

## Flashing

### Arduino IDE
1. Open `firmware/smart_farm_wss_db_aligned.ino`
2. **Tools → Board** → `ESP32S3 Dev Module`
3. **Tools → Port** → select your USB-serial port
4. **Sketch → Upload**

### Monitor
Open **Tools → Serial Monitor** at **115200 baud** to view boot messages and sensor readings.

---

## FreeRTOS Task Architecture

| Core | Task | Stack | Responsibilities |
|------|------|-------|-----------------|
| Core 0 | `NetworkTask` | 16 KB | WiFi, NTP, WebSocket (TLS), MQTT, publish, LEDs |
| Core 1 | `ControlTask` | 8 KB | RS485/Modbus sensors, ADC, relay control, backup logic |

Inter-task communication uses **FreeRTOS queues** only (`sensorQueue`, `actuatorQueue`, `ackQueue`).

---

## Backup Mode

If no MQTT heartbeat is received for **30 seconds**, the firmware enters **backup mode**:
- Applies local threshold logic autonomously (see thresholds in the root README)
- Sets the red LED
- Clears backup mode and resets all relays on MQTT reconnection
