
/*
 Smart Farm firmware - Secure MQTT over WebSocket (WSS)
 Board: ESP32-S3

 Core separation:
 - Core 0: NetworkTask (WiFi, NTP, WebSocket, MQTT, publishing, LED)
 - Core 1: ControlTask (sensors, relays, local backup)
 Communication between the two: FreeRTOS queues only.

 Network lifecycle (as in the working simple test):
 1. WiFi connected
 2. The WebSocket is opened ONCE and kept open (the library reconnects automatically)
 3. When the WebSocket is ready -> ONLY ONE MQTT CONNECT packet per WebSocket session
 4. If MQTT fails or disconnects -> start a fresh WebSocket session

 Local logic (backup) aligned with the "sensors" database table:
 - temperature : > 28 ventilator_on / < 17 ventilator_off
 - humidity    : < 62 humidifier_on / > 73 open_roof
 - soil YL-69  : < 20 water_pump_on / > 80 no action in the database

 Pin map:
 - RS485 / XY-MD02: GPIO17 TX2, GPIO18 RX2
 - YL-69: GPIO8 AO, GPIO9 DO
 - Relays: GPIO4, 5, 6, 7, 15, 16, 3, 10
 - LED: GPIO13 green, GPIO14 red
*/

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>   // "WebSockets" library by Markus Sattler
#include <PubSubClient.h>
#include <ModbusMaster.h>
#include <time.h>
#include <esp_task_wdt.h>

// -----------------------------------------------------------------------------
// Diagnostic options
// -----------------------------------------------------------------------------
#define WS_DEBUG        1   // 1 = display WebSocket events (CONNECTED, TX, RX...)
#define USE_MQTT_WILL   0   // 0 = no will message (like the simple test). Set to 1 once everything works.
#define USE_CA_CERT     0   // 0 = encrypted but not verified. 1 = verify the broker using the EMQX CA.

// -----------------------------------------------------------------------------
// Cores
// -----------------------------------------------------------------------------
#define CORE_NETWORK 0
#define CORE_CONTROL 1

// ---- Credentials — loaded from secrets.h (gitignored) ----
// Copy firmware/secrets.h.example to firmware/secrets.h and fill in your values.
#include "secrets.h"

// ---- MQTT / EMQX broker (WSS) ----
// Broker host/port/path and credentials are defined in secrets.h.
const char* BROKER_HOST   = MQTT_BROKER_HOST;
const int   BROKER_PORT   = MQTT_BROKER_PORT;
const char* WS_PATH       = MQTT_WS_PATH;
const char* MQTT_USERNAME = MQTT_USER;
const char* MQTT_PASSWORD = MQTT_PASS;

#if USE_CA_CERT
const char* EMQX_CA_CERT = EMQX_CA_CERT_PEM;
#endif

const char* DEVICE_ID = "dht11H";

const char* TOPIC_SENSOR_XYMD02   = "smartfarm/sensors/XY-MD02";
const char* TOPIC_SENSOR_YL69     = "smartfarm/sensors/YL-69";
const char* TOPIC_SENSOR_INCIDENT = "smartfarm/sensors/incident";
const char* TOPIC_DEVICE_STATUS   = "smartfarm/devices/dht11H/status";
const char* TOPIC_DEVICE_ACK      = "smartfarm/devices/dht11H/ack";
const char* TOPIC_ACTUATORS       = "smartfarm/actuators/#";

// -----------------------------------------------------------------------------
// Hardware
// -----------------------------------------------------------------------------
const uint8_t RS485_TX_PIN = 17;
const uint8_t RS485_RX_PIN = 18;
const int RS485_DE_RE_PIN = -1;  // -1 = RS485 module with automatic direction control

const uint8_t YL69_ANALOG_PIN = 8;
const uint8_t YL69_DIGITAL_PIN = 9;

const uint8_t RELAY_PINS[] = {
  4,   // 1 - fan
  5,   // 2 - humidifier
  6,   // 3 - water pump
  7,   // 4 - light
  15,  // 5 - roof
  16,  // 6 - unused
  3,   // 7 - unused (GPIO3 is a strapping pin; avoid it if possible)
  10   // 8 - unused
};
const size_t RELAY_COUNT = sizeof(RELAY_PINS) / sizeof(RELAY_PINS[0]);

const uint8_t LED_GREEN_PIN = 13;
const uint8_t LED_RED_PIN = 14;

// If your relays are active LOW, reverse these two values.
const uint8_t RELAY_ON_LEVEL = HIGH;
const uint8_t RELAY_OFF_LEVEL = LOW;

// -----------------------------------------------------------------------------
// Sensor / control configuration
// -----------------------------------------------------------------------------
const uint8_t MD02_SLAVE_ID = 1;
const uint32_t MD02_BAUDRATE = 9600;

const unsigned long XYMD02_INTERVAL_MS = 15000UL;
const unsigned long YL69_INTERVAL_MS = 60000UL;
const unsigned long STATUS_HEARTBEAT_MS = 15000UL;
const unsigned long BACKUP_ACTIVATE_MS = 30000UL;
const unsigned long OPEN_ROOF_PULSE_MS = 2500UL;
const unsigned long MQTT_RETRY_MS = 3000UL;
const unsigned long WIFI_RETRY_MS = 10000UL;

const int SENSOR_MAX_RETRIES = 3;
const unsigned long SENSOR_RETRY_DELAY_MS = 200UL;

const int YL69_DRY_VALUE = 4095;
const int YL69_WET_VALUE = 1200;

// Thresholds and actions aligned with the database "sensors" table (source of truth):
//   Temperature: < 17 -> ventilator_off | > 28 -> ventilator_on
//   Humidity   : < 62 -> humidifier_on  | > 73 -> open_roof
//   Soil (YL-69): < 20 -> water_pump_on | > 80 -> no action in the database
const float TEMP_MIN_WARNING = 17.0f;
const float TEMP_MAX_WARNING = 28.0f;
const float HUM_MIN_WARNING = 62.0f;
const float HUM_MAX_WARNING = 73.0f;
const int SOIL_DRY_THRESHOLD = 20;
const int SOIL_WET_THRESHOLD = 80;

// The database has no "humidifier_off" or "water_pump_off" action.
// Without these actions, the humidifier and pump would remain ON in backup mode
// even when the measurement exceeds the upper threshold.
// true  = in backup mode, turn them OFF when the measurement exceeds the upper threshold (safer)
// false = behavior strictly identical to the database (no shutoff)
const bool BACKUP_STOP_ON_HIGH = true;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
enum SensorMsgType : uint8_t { MSG_XYMD02, MSG_YL69, MSG_INCIDENT };

struct SensorMsg {
  SensorMsgType type;
  float temperature;
  float humidity;
  int soilMoisturePercent;
  int soilMoistureDigital;
  char errorMsg[96];
  unsigned long timestamp;
};

struct LatestSensorData {
  float temperature = 0.0f;
  float humidity = 0.0f;
  bool md02Valid = false;
  int soilMoisturePercent = 0;
  int soilMoistureDigital = 0;
  bool yl69Valid = false;
};

struct CommandMsg {
  char topic[96];
  char payload[512];
};

struct AckMsg {
  char actionId[48];
  char status[16];
  char action[48];
  char error[48];
};

// =============================================================================
// WebSocket -> Client adapter (for PubSubClient)
// Used only by NetworkTask (Core 0).
//
// Key differences from the previous version:
// - connect() does NOT reopen the WebSocket; it only reports whether it is ready
// - stop() does NOT close the WebSocket (PubSubClient calls it after each failure)
// - the WebSocket is opened once by beginWs(), and resetWs() starts a fresh session
// =============================================================================
class WsMqttClient : public Client {
 public:
  WsMqttClient() {
    ws.onEvent([this](WStype_t type, uint8_t* payload, size_t length) {
      onWsEvent(type, payload, length);
    });
  }

  // ---- WebSocket management (called by networkTask) ----
  void beginWs() {
    clearBuffer();
    connectedFlag = false;
    sessionUsed = false;
#if USE_CA_CERT
    ws.beginSslWithCA(BROKER_HOST, BROKER_PORT, WS_PATH, EMQX_CA_CERT, "mqtt");
#else
    ws.beginSSL(BROKER_HOST, BROKER_PORT, WS_PATH, "", "mqtt");  // "mqtt" subprotocol is mandatory
#endif
    ws.setReconnectInterval(2000);
    started = true;
    Serial.println("[WS] beginSSL started");
  }

  void resetWs() {
    Serial.println("[WS] Resetting WebSocket session");
    ws.disconnect();
    connectedFlag = false;
    clearBuffer();
    beginWs();
  }

  void service()           { if (started) ws.loop(); }
  bool isStarted() const   { return started; }
  bool isUp() const        { return connectedFlag; }
  bool isSessionUsed() const { return sessionUsed; }

  // ---- Client interface ----
  int connect(const char* host, uint16_t port) {
    // PubSubClient calls this before sending CONNECT: do not reopen anything.
    clearBuffer();
    sessionUsed = true;  // an MQTT CONNECT will be sent over this WebSocket session
    return connectedFlag ? 1 : 0;
  }
  int connect(IPAddress, uint16_t) { return connectedFlag ? 1 : 0; }
  int connect(const char* host, uint16_t port, int32_t) { return connect(host, port); }
  int connect(IPAddress, uint16_t, int32_t) { return connectedFlag ? 1 : 0; }

  size_t write(uint8_t b) { return write(&b, 1); }
  size_t write(const uint8_t* buf, size_t size) {
    if (!connectedFlag) {
#if WS_DEBUG
      Serial.println("[WS] write: WebSocket not connected");
#endif
      return 0;
    }
    bool ok = ws.sendBIN(const_cast<uint8_t*>(buf), size);
#if WS_DEBUG
    Serial.printf("[WS] TX %u bytes (first=0x%02X) -> %s\n",
                  (unsigned)size, size ? buf[0] : 0, ok ? "ok" : "FAILED");
#endif
    return ok ? size : 0;
  }

  int available() { service(); return (int)count; }
  int read() {
    if (count == 0) return -1;
    uint8_t b = ring[tail];
    tail = (tail + 1) % RING_SIZE;
    count--;
    return b;
  }
  int read(uint8_t* buf, size_t size) {
    size_t n = 0;
    while (n < size && count > 0) buf[n++] = (uint8_t)read();
    return (int)n;
  }
  int peek() { return count ? ring[tail] : -1; }
  void flush() {}

  // PubSubClient calls stop() after a failure: only clear the buffer.
  void stop() { clearBuffer(); }

  uint8_t connected() { service(); return connectedFlag ? 1 : 0; }
  operator bool() { return connectedFlag; }

private:
  static const size_t RING_SIZE = 4096;
  WebSocketsClient ws;
  uint8_t ring[RING_SIZE];
  size_t head = 0, tail = 0, count = 0;
  volatile bool connectedFlag = false;
  bool started = false;
  bool sessionUsed = false;

  void clearBuffer() { head = tail = count = 0; }

  void push(const uint8_t* data, size_t len) {
    for (size_t i = 0; i < len; i++) {
      if (count >= RING_SIZE) {
        Serial.println("[WS] Buffer full, bytes lost");
        return;
      }
      ring[head] = data[i];
      head = (head + 1) % RING_SIZE;
      count++;
    }
  }

  void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
      case WStype_CONNECTED:
        Serial.printf("[WS] CONNECTED: %s\n", payload ? (const char*)payload : "");
        clearBuffer();
        sessionUsed = false;   // new session: one MQTT CONNECT is allowed
        connectedFlag = true;
        break;

      case WStype_DISCONNECTED:
        Serial.println("[WS] DISCONNECTED");
        connectedFlag = false;
        clearBuffer();
        break;

      case WStype_ERROR:
        Serial.println("[WS] ERROR");
        break;

      case WStype_TEXT:
        Serial.printf("[WS] TEXT received (%u bytes) - unexpected for MQTT\n", (unsigned)length);
        break;

      case WStype_BIN:
      case WStype_FRAGMENT_BIN_START:
      case WStype_FRAGMENT:
      case WStype_FRAGMENT_FIN:
#if WS_DEBUG
        Serial.printf("[WS] RX %u bytes, first=0x%02X\n",
                      (unsigned)length, length ? payload[0] : 0);
#endif
        push(payload, length);
        break;

      default:
        break;
    }
  }
};

// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
QueueHandle_t sensorQueue = nullptr;    // control -> network
QueueHandle_t ackQueue = nullptr;       // control -> network
QueueHandle_t actuatorQueue = nullptr; // network -> control

volatile bool backupModeActive = false;
volatile unsigned long lastMqttConnectedAt = 0;

ModbusMaster md02;
WsMqttClient wsTransport;
PubSubClient mqttClient(wsTransport);  // used ONLY by networkTask

// Variables reserved for networkTask
unsigned long lastStatusHeartbeatAt = 0;
unsigned long lastWifiAttemptAt = 0;
bool wifiWasConnected = false;
bool timeSynced = false;

// Variables reserved for controlTask
char lastActionIds[6][48];
uint8_t lastActionIdCount = 0;
uint8_t lastActionIdCursor = 0;

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
void setRelay(uint8_t pin, bool on) {
  digitalWrite(pin, on ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
}

bool isRelayOn(uint8_t pin) {
  return digitalRead(pin) == RELAY_ON_LEVEL;
}

void setLedState(uint8_t pin, bool on) {
  digitalWrite(pin, on ? HIGH : LOW);
}

const char* mqttStateText(int state) {
  switch (state) {
    case -4: return "MQTT_CONNECTION_TIMEOUT (no CONNACK)";
    case -3: return "MQTT_CONNECTION_LOST";
    case -2: return "MQTT_CONNECT_FAILED (WebSocket not ready)";
    case -1: return "MQTT_DISCONNECTED";
    case 0:  return "MQTT_CONNECTED";
    case 1:  return "MQTT_CONNECT_BAD_PROTOCOL";
    case 2:  return "MQTT_CONNECT_BAD_CLIENT_ID";
    case 3:  return "MQTT_CONNECT_UNAVAILABLE";
    case 4:  return "MQTT_CONNECT_BAD_CREDENTIALS";
    case 5:  return "MQTT_CONNECT_UNAUTHORIZED (check username/password in EMQX)";
    default: return "UNKNOWN";
  }
}

const char* resetReasonText(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON:   return "power-on";
    case ESP_RST_SW:        return "software restart";
    case ESP_RST_PANIC:     return "PANIC (look for 'Guru Meditation' above)";
    case ESP_RST_INT_WDT:   return "interrupt watchdog";
    case ESP_RST_TASK_WDT:  return "task watchdog";
    case ESP_RST_WDT:       return "other watchdog";
    case ESP_RST_BROWNOUT:  return "BROWNOUT (insufficient power supply)";
    case ESP_RST_DEEPSLEEP: return "deep sleep wake";
    default:                return "other / external / USB";
  }
}

// Converts a technical action name into a readable message for the Serial Monitor.
const char* describeAction(const char* actionName) {
  if (strcmp(actionName, "ventilator_on") == 0)   return "Fan ON";
  if (strcmp(actionName, "ventilator_off") == 0)  return "Fan OFF";
  if (strcmp(actionName, "humidifier_on") == 0)   return "Humidifier ON";
  if (strcmp(actionName, "humidifier_off") == 0)  return "Humidifier OFF";
  if (strcmp(actionName, "water_pump_on") == 0)   return "Water pump ON";
  if (strcmp(actionName, "water_pump_off") == 0)  return "Water pump OFF";
  if (strcmp(actionName, "light_on") == 0)        return "Light ON";
  if (strcmp(actionName, "light_off") == 0)       return "Light OFF";
  if (strcmp(actionName, "open_roof") == 0)       return "Roof: OPENING (pulse)";
  if (strcmp(actionName, "close_roof") == 0)      return "Roof: CLOSING (relay OFF)";
  return "Unknown action";
}

bool extractJsonStringField(const char* json, const char* key, char* out, size_t outSize) {
  if (!json || !key || !out || outSize == 0) return false;

  char pattern[64];
  snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  const char* position = strstr(json, pattern);
  if (!position) return false;

  position += strlen(pattern);
  while (*position == ' ' || *position == '\t' || *position == ':') position++;

  if (*position != '"') return false;
  position++;

  const char* end = strchr(position, '"');
  if (!end) return false;

  size_t len = (size_t)(end - position);
  if (len >= outSize) len = outSize - 1;
  memcpy(out, position, len);
  out[len] = '\0';
  return true;
}

bool parseActuatorTopic(const char* topic, char* deviceIdOut, size_t deviceIdSize,
                        char* actionOut, size_t actionSize) {
  const char* prefix = "smartfarm/actuators/";
  size_t prefixLen = strlen(prefix);
  if (strncmp(topic, prefix, prefixLen) != 0) return false;

  const char* deviceStart = topic + prefixLen;
  const char* lastSlash = strrchr(deviceStart, '/');
  if (!lastSlash) return false;

  size_t deviceLen = (size_t)(lastSlash - deviceStart);
  size_t actionLen = strlen(lastSlash + 1);
  if (deviceLen == 0 || actionLen == 0) return false;

  if (deviceLen >= deviceIdSize) deviceLen = deviceIdSize - 1;
  if (actionLen >= actionSize) actionLen = actionSize - 1;

  memcpy(deviceIdOut, deviceStart, deviceLen);
  deviceIdOut[deviceLen] = '\0';
  memcpy(actionOut, lastSlash + 1, actionLen);
  actionOut[actionLen] = '\0';
  return true;
}

bool hasSeenActionId(const char* actionId) {
  for (uint8_t i = 0; i < lastActionIdCount; i++) {
    if (strcmp(lastActionIds[i], actionId) == 0) return true;
  }
  return false;
}

void rememberActionId(const char* actionId) {
  strlcpy(lastActionIds[lastActionIdCursor], actionId, sizeof(lastActionIds[0]));
  if (lastActionIdCount < 6) lastActionIdCount++;
  lastActionIdCursor = (lastActionIdCursor + 1) % 6;
}

// =============================================================================
// NETWORK SECTION (executed only by NetworkTask, Core 0)
// =============================================================================

void publishDeviceStatus(const char* status, const char* reason = nullptr) {
  char payload[160];
  if (reason && reason[0] != '\0') {
    snprintf(payload, sizeof(payload),
             "{\"device_id\":\"%s\",\"status\":\"%s\",\"reason\":\"%s\",\"uptime_ms\":%lu}",
             DEVICE_ID, status, reason, millis());
  } else {
    snprintf(payload, sizeof(payload),
             "{\"device_id\":\"%s\",\"status\":\"%s\",\"uptime_ms\":%lu}",
             DEVICE_ID, status, millis());
  }
  bool ok = mqttClient.publish(TOPIC_DEVICE_STATUS, payload, true);

  if (reason && reason[0] != '\0') {
    Serial.printf("[SEND] Module status: %s (%s) -> %s%s\n",
                  status, reason, TOPIC_DEVICE_STATUS, ok ? "" : "  [FAILED]");
  } else {
    Serial.printf("[SEND] Module status: %s (heartbeat) -> %s%s\n",
                  status, TOPIC_DEVICE_STATUS, ok ? "" : "  [FAILED]");
  }
}

void publishAckMsg(const AckMsg& ack) {
  char actionPart[72] = "";
  char errorPart[72] = "";
  if (ack.action[0] != '\0') {
    snprintf(actionPart, sizeof(actionPart), ",\"action\":\"%s\"", ack.action);
  }
  if (ack.error[0] != '\0') {
    snprintf(errorPart, sizeof(errorPart), ",\"error\":\"%s\"", ack.error);
  }

  char payload[320];
  snprintf(payload, sizeof(payload),
           "{\"device_id\":\"%s\",\"actionId\":\"%s\",\"status\":\"%s\"%s%s,\"timestamp\":%lu}",
           DEVICE_ID, ack.actionId, ack.status, actionPart, errorPart, millis());
  bool ok = mqttClient.publish(TOPIC_DEVICE_ACK, payload, false);

  if (strcmp(ack.status, "success") == 0) {
    Serial.printf("[SEND] Server confirmation: \"%s\" executed successfully (id=%s) -> %s%s\n",
                  describeAction(ack.action), ack.actionId, TOPIC_DEVICE_ACK, ok ? "" : "  [FAILED]");
  } else {
    Serial.printf("[SEND] Server confirmation: \"%s\" failed (%s) (id=%s) -> %s%s\n",
                  ack.action, ack.error, ack.actionId, TOPIC_DEVICE_ACK, ok ? "" : "  [FAILED]");
  }
}

void publishSensorMessage(const SensorMsg& msg) {
  char payload[256];
  bool ok;

  switch (msg.type) {
    case MSG_XYMD02:
      snprintf(payload, sizeof(payload),
               "{\"device_id\":\"%s\",\"temperature\":%.1f,\"humidity\":%.1f,\"ts\":%lu}",
               DEVICE_ID, msg.temperature, msg.humidity, msg.timestamp);
      ok = mqttClient.publish(TOPIC_SENSOR_XYMD02, payload, false);
      Serial.printf("[SEND] Air measurements: temperature %.1f C, humidity %.1f %% -> %s%s\n",
                    msg.temperature, msg.humidity, TOPIC_SENSOR_XYMD02, ok ? "" : "  [FAILED]");
      break;

    case MSG_YL69:
      snprintf(payload, sizeof(payload),
               "{\"device_id\":\"%s\",\"soil_moisture_percent\":%d,\"soil_digital\":%d,\"ts\":%lu}",
               DEVICE_ID, msg.soilMoisturePercent, msg.soilMoistureDigital, msg.timestamp);
      ok = mqttClient.publish(TOPIC_SENSOR_YL69, payload, false);
      Serial.printf("[SEND] Soil measurement: soil moisture %d %% (digital=%d) -> %s%s\n",
                    msg.soilMoisturePercent, msg.soilMoistureDigital, TOPIC_SENSOR_YL69,
                    ok ? "" : "  [FAILED]");
      break;

    case MSG_INCIDENT:
      snprintf(payload, sizeof(payload),
               "{\"device_id\":\"%s\",\"error\":\"%s\",\"ts\":%lu}",
               DEVICE_ID, msg.errorMsg, msg.timestamp);
      ok = mqttClient.publish(TOPIC_SENSOR_INCIDENT, payload, false);
      Serial.printf("[SEND] Sensor incident: %s -> %s%s\n",
                    msg.errorMsg, TOPIC_SENSOR_INCIDENT, ok ? "" : "  [FAILED]");
      break;
  }
}

void publishQueues() {
  SensorMsg sensorMsg;
  while (xQueueReceive(sensorQueue, &sensorMsg, 0) == pdTRUE) {
    publishSensorMessage(sensorMsg);
  }
  AckMsg ackMsg;
  while (xQueueReceive(ackQueue, &ackMsg, 0) == pdTRUE) {
    publishAckMsg(ackMsg);
  }
}

void discardQueues() {
  SensorMsg sensorDiscard;
  while (xQueueReceive(sensorQueue, &sensorDiscard, 0) == pdTRUE) {}
  AckMsg ackDiscard;
  while (xQueueReceive(ackQueue, &ackDiscard, 0) == pdTRUE) {}
}

// MQTT callback: called by mqttClient.loop(); it only puts the message in a queue.
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  CommandMsg msg;
  memset(&msg, 0, sizeof(msg));

  strlcpy(msg.topic, topic, sizeof(msg.topic));

  unsigned int copyLength = length;
  if (copyLength >= sizeof(msg.payload)) copyLength = sizeof(msg.payload) - 1;
  memcpy(msg.payload, payload, copyLength);
  msg.payload[copyLength] = '\0';

  xQueueSend(actuatorQueue, &msg, 0);
}

void updateNetworkLeds(bool mqttOk) {
  setLedState(LED_GREEN_PIN, mqttOk);
  setLedState(LED_RED_PIN, !mqttOk);
}

void updateBackupState(const char* reason) {
  unsigned long elapsed = millis() - lastMqttConnectedAt;
  if (!backupModeActive && elapsed > BACKUP_ACTIVATE_MS) {
    backupModeActive = true;
    Serial.println("=====================================================");
    Serial.printf("[BACKUP] Activated: %s\n", reason);
    Serial.printf("[BACKUP] No MQTT connection for %lu ms -> local control enabled\n", elapsed);
    Serial.println("=====================================================");
  }
}

void clearBackupState() {
  if (backupModeActive) {
    backupModeActive = false;
    Serial.println("=====================================================");
    Serial.println("[BACKUP] Deactivated: MQTT connection restored, remote control resumed");
    Serial.println("=====================================================");
  }
}

void startWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);          // prevents packet loss caused by power-saving mode
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWifiAttemptAt = millis();
  Serial.println("[WiFi] Connecting...");
}

bool ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      Serial.printf("[WiFi] Connected, IP: %s, RSSI: %d\n",
                    WiFi.localIP().toString().c_str(), WiFi.RSSI());
      wifiWasConnected = true;
    }
    return true;
  }

  if (wifiWasConnected) {
    Serial.println("[WiFi] Disconnected, attempting to reconnect...");
    wifiWasConnected = false;
  }

  if (millis() - lastWifiAttemptAt >= WIFI_RETRY_MS) {
    lastWifiAttemptAt = millis();
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.println("[WiFi] Retrying...");
  }
  return false;
}

// Non-blocking: starts NTP once, then checks synchronization once per second.
void syncTimeStep() {
  if (timeSynced) return;

  static bool started = false;
  static unsigned long lastCheckAt = 0;

  if (!started) {
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    started = true;
    lastCheckAt = millis();
    return;
  }

  if (millis() - lastCheckAt < 1000UL) return;
  lastCheckAt = millis();

  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 0)) {
    timeSynced = true;
    Serial.println("[TIME] NTP synchronized");
  }
}

void configureMqtt() {
  mqttClient.setServer(BROKER_HOST, BROKER_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);
  mqttClient.setKeepAlive(15);
  mqttClient.setSocketTimeout(10);
}

// Only one MQTT CONNECT per WebSocket session.
bool connectMqtt() {
  if (mqttClient.connected()) return true;

  // The current WebSocket session has already been used for a CONNECT
  // (which failed or ended): a second CONNECT on the same session would be
  // rejected by the broker. Start a fresh session instead.
  if (wsTransport.isSessionUsed()) {
    wsTransport.resetWs();
    return false;
  }

  if (!wsTransport.isUp()) return false;

  static unsigned long lastAttemptAt = 0;
  if (lastAttemptAt != 0 && millis() - lastAttemptAt < MQTT_RETRY_MS) return false;
  lastAttemptAt = millis();

  // Unique client ID based on the MAC address (as in the simple test)
  char clientId[40];
  snprintf(clientId, sizeof(clientId), "ESP32S3-%08X", (unsigned)(uint32_t)ESP.getEfuseMac());

  Serial.printf("[MQTT] Sending CONNECT (clientId=%s)...\n", clientId);

  bool ok;
#if USE_MQTT_WILL
  char willMessage[64];
  snprintf(willMessage, sizeof(willMessage),
           "{\"device_id\":\"%s\",\"status\":\"offline\"}", DEVICE_ID);
  ok = mqttClient.connect(clientId, MQTT_USERNAME, MQTT_PASSWORD,
                          TOPIC_DEVICE_STATUS, 0, true, willMessage);
#else
  ok = mqttClient.connect(clientId, MQTT_USERNAME, MQTT_PASSWORD);
#endif

  if (!ok) {
    int state = mqttClient.state();
    Serial.printf("[MQTT] Connect failed, state=%d: %s | free heap=%u\n",
                  state, mqttStateText(state), (unsigned)ESP.getFreeHeap());
    return false;  // the session will be reset on the next iteration
  }

  mqttClient.subscribe(TOPIC_ACTUATORS);
  Serial.printf("[MQTT] Subscribed to commands: %s\n", TOPIC_ACTUATORS);
  publishDeviceStatus("online", "connected");
  lastMqttConnectedAt = millis();
  lastStatusHeartbeatAt = millis();
  clearBackupState();

  Serial.println("[MQTT] Connected");
  return true;
}

void networkTask(void* pvParameters) {
  startWiFi();
  configureMqtt();
  lastMqttConnectedAt = millis();
  updateNetworkLeds(false);

  bool wasMqttConnected = false;
  unsigned long lastDiagAt = 0;
  unsigned long lastWsWaitLogAt = 0;

  for (;;) {
    if (millis() - lastDiagAt >= 10000UL) {
      lastDiagAt = millis();
      Serial.printf("[DIAG] core=%d heap=%u minHeap=%u stackFreeMin=%u ws=%d mqtt=%d\n",
                    xPortGetCoreID(), (unsigned)ESP.getFreeHeap(),
                    (unsigned)ESP.getMinFreeHeap(),
                    (unsigned)uxTaskGetStackHighWaterMark(nullptr),
                    wsTransport.isUp() ? 1 : 0, mqttClient.connected() ? 1 : 0);
    }

    // ---- 1) WiFi ----
    if (!ensureWiFiConnected()) {
      updateBackupState("WiFi unavailable");
      discardQueues();
      updateNetworkLeds(false);
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    syncTimeStep();

    // ---- 2) WebSocket: opened only once; the library handles reconnection ----
    if (!wsTransport.isStarted()) {
#if USE_CA_CERT
      if (timeSynced) wsTransport.beginWs();   // certificate verification requires the correct time
#else
      wsTransport.beginWs();
#endif
    }
    wsTransport.service();

    if (!wsTransport.isUp()) {
      if (wasMqttConnected) {
        Serial.println("[MQTT] Connection lost (WebSocket down)");
        wasMqttConnected = false;
      }
      if (millis() - lastWsWaitLogAt >= 5000UL) {
        lastWsWaitLogAt = millis();
        Serial.println("[WS] Waiting for WebSocket...");
      }
      updateBackupState("WebSocket unavailable");
      discardQueues();
      updateNetworkLeds(false);
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }

    // ---- 3) MQTT over the ready WebSocket ----
    bool connected = connectMqtt();

    if (connected) {
      mqttClient.loop();
      connected = mqttClient.connected();  // loop() may detect a disconnection
    }

    if (!connected) {
      if (wasMqttConnected) {
        Serial.println("[MQTT] Connection lost");
        wasMqttConnected = false;
      }
      updateBackupState("MQTT unavailable");
      discardQueues();
      updateNetworkLeds(false);
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }

    wasMqttConnected = true;
    lastMqttConnectedAt = millis();
    updateNetworkLeds(true);

    if (millis() - lastStatusHeartbeatAt >= STATUS_HEARTBEAT_MS) {
      publishDeviceStatus("online", nullptr);
      lastStatusHeartbeatAt = millis();
    }

    publishQueues();
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

// =============================================================================
// CONTROL SECTION (executed only by ControlTask, Core 1)
// =============================================================================

void queueAck(const char* actionId, const char* status,
              const char* actionName = nullptr, const char* error = nullptr) {
  AckMsg ack;
  memset(&ack, 0, sizeof(ack));
  strlcpy(ack.actionId, actionId, sizeof(ack.actionId));
  strlcpy(ack.status, status, sizeof(ack.status));
  if (actionName) strlcpy(ack.action, actionName, sizeof(ack.action));
  if (error) strlcpy(ack.error, error, sizeof(ack.error));
  xQueueSend(ackQueue, &ack, 0);
}

void sendIncident(const char* sensorName, const char* errorDetail) {
  SensorMsg msg;
  memset(&msg, 0, sizeof(msg));
  msg.type = MSG_INCIDENT;
  snprintf(msg.errorMsg, sizeof(msg.errorMsg), "%s: %s", sensorName, errorDetail);
  msg.timestamp = millis();
  xQueueSend(sensorQueue, &msg, 0);
  Serial.printf("[INCIDENT] %s\n", msg.errorMsg);
}

void rs485PreTransmission() {
  if (RS485_DE_RE_PIN >= 0) digitalWrite(RS485_DE_RE_PIN, HIGH);
}

void rs485PostTransmission() {
  if (RS485_DE_RE_PIN >= 0) digitalWrite(RS485_DE_RE_PIN, LOW);
}

// Yields control to the system while waiting for Modbus.
void modbusIdle() {
  vTaskDelay(1);
}

const char* modbusErrorText(uint8_t code) {
  switch (code) {
    case 0xE0: return "invalid slave id";
    case 0xE1: return "invalid function";
    case 0xE2: return "response timeout (no reply from sensor)";
    case 0xE3: return "invalid CRC";
    default:   return "modbus exception";
  }
}

bool readXYMD02Once(float& temperature, float& humidity) {
  uint8_t result = md02.readInputRegisters(0x0001, 2);
  if (result != md02.ku8MBSuccess) {
    Serial.printf("[XY-MD02] Modbus error: 0x%02X (%s)\n", result, modbusErrorText(result));
    return false;
  }

  int16_t rawTemp = (int16_t)md02.getResponseBuffer(0);
  uint16_t rawHumidity = md02.getResponseBuffer(1);
  temperature = rawTemp / 10.0f;
  humidity = rawHumidity / 10.0f;
  return true;
}

bool readXYMD02(float& temperature, float& humidity) {
  for (int attempt = 1; attempt <= SENSOR_MAX_RETRIES; attempt++) {
    if (readXYMD02Once(temperature, humidity)) {
      if (attempt > 1) {
        Serial.printf("[XY-MD02] Success on attempt %d/%d\n", attempt, SENSOR_MAX_RETRIES);
      }
      return true;
    }
    Serial.printf("[XY-MD02] Attempt %d/%d failed\n", attempt, SENSOR_MAX_RETRIES);
    if (attempt < SENSOR_MAX_RETRIES) vTaskDelay(pdMS_TO_TICKS(SENSOR_RETRY_DELAY_MS));
  }

  sendIncident("XY-MD02", "Sensor not responding after 3 attempts");
  return false;
}

bool readYL69Once(int& moisturePercent, int& digitalValue) {
  int rawValue = analogRead(YL69_ANALOG_PIN);
  digitalValue = digitalRead(YL69_DIGITAL_PIN);

  if (rawValue <= 10 || rawValue >= 4085) {
    Serial.printf("[YL-69] Raw analog value out of range: %d\n", rawValue);
    return false;
  }

  moisturePercent = constrain(map(rawValue, YL69_DRY_VALUE, YL69_WET_VALUE, 0, 100), 0, 100);
  return true;
}

bool readYL69(int& moisturePercent, int& digitalValue) {
  for (int attempt = 1; attempt <= SENSOR_MAX_RETRIES; attempt++) {
    if (readYL69Once(moisturePercent, digitalValue)) {
      if (attempt > 1) {
        Serial.printf("[YL-69] Success on attempt %d/%d\n", attempt, SENSOR_MAX_RETRIES);
      }
      return true;
    }
    Serial.printf("[YL-69] Attempt %d/%d failed\n", attempt, SENSOR_MAX_RETRIES);
    if (attempt < SENSOR_MAX_RETRIES) vTaskDelay(pdMS_TO_TICKS(SENSOR_RETRY_DELAY_MS));
  }

  sendIncident("YL-69", "Sensor not responding after 3 attempts");
  return false;
}

void handleXYMD02(LatestSensorData& latest) {
  float temperature = 0.0f;
  float humidity = 0.0f;
  if (!readXYMD02(temperature, humidity)) {
    latest.md02Valid = false;
    return;
  }

  latest.temperature = temperature;
  latest.humidity = humidity;
  latest.md02Valid = true;

  SensorMsg msg;
  memset(&msg, 0, sizeof(msg));
  msg.type = MSG_XYMD02;
  msg.temperature = temperature;
  msg.humidity = humidity;
  msg.timestamp = millis();
  xQueueSend(sensorQueue, &msg, 0);

  Serial.printf("[READING] XY-MD02 air sensor: temperature %.1f C, humidity %.1f %%\n",
                temperature, humidity);
}

void handleYL69(LatestSensorData& latest) {
  int moisturePercent = 0;
  int digitalValue = 0;
  if (!readYL69(moisturePercent, digitalValue)) {
    latest.yl69Valid = false;
    return;
  }

  latest.soilMoisturePercent = moisturePercent;
  latest.soilMoistureDigital = digitalValue;
  latest.yl69Valid = true;

  SensorMsg msg;
  memset(&msg, 0, sizeof(msg));
  msg.type = MSG_YL69;
  msg.soilMoisturePercent = moisturePercent;
  msg.soilMoistureDigital = digitalValue;
  msg.timestamp = millis();
  xQueueSend(sensorQueue, &msg, 0);

  Serial.printf("[READING] YL-69 soil sensor: soil moisture %d %% (digital=%d)\n",
                moisturePercent, digitalValue);
}

// Non-blocking roof pulse (used only by controlTask).
// The relay is activated, then switched OFF by updateRoofPulse() after OPEN_ROOF_PULSE_MS,
// without blocking sensor readings or incoming commands.
bool roofPulseActive = false;
unsigned long roofPulseEndAt = 0;

// In backup mode: remains true while humidity stays above the upper threshold
// (prevents repeatedly opening the roof).
bool roofOpenedForHumidity = false;

void startRoofPulse() {
  setRelay(RELAY_PINS[4], true);
  roofPulseEndAt = millis() + OPEN_ROOF_PULSE_MS;
  roofPulseActive = true;
}

void stopRoofPulse() {
  setRelay(RELAY_PINS[4], false);
  roofPulseActive = false;
}

void updateRoofPulse() {
  if (roofPulseActive && (long)(millis() - roofPulseEndAt) >= 0) {
    stopRoofPulse();
    Serial.println("[ACTION] Roof: opening pulse ended, relay switched OFF");
  }
}

bool handleActionName(const char* actionName) {
  if (strcmp(actionName, "ventilator_on") == 0)  { setRelay(RELAY_PINS[0], true);  return true; }
  if (strcmp(actionName, "ventilator_off") == 0) { setRelay(RELAY_PINS[0], false); return true; }
  if (strcmp(actionName, "humidifier_on") == 0)  { setRelay(RELAY_PINS[1], true);  return true; }
  if (strcmp(actionName, "humidifier_off") == 0) { setRelay(RELAY_PINS[1], false); return true; }
  if (strcmp(actionName, "water_pump_on") == 0)  { setRelay(RELAY_PINS[2], true);  return true; }
  if (strcmp(actionName, "water_pump_off") == 0) { setRelay(RELAY_PINS[2], false); return true; }
  if (strcmp(actionName, "light_on") == 0)       { setRelay(RELAY_PINS[3], true);  return true; }
  if (strcmp(actionName, "light_off") == 0)      { setRelay(RELAY_PINS[3], false); return true; }
  if (strcmp(actionName, "open_roof") == 0)      { startRoofPulse(); return true; }
  if (strcmp(actionName, "close_roof") == 0)     { stopRoofPulse();  return true; }
  return false;
}

void processActuatorCommand(const CommandMsg& cmd) {
  char topicDeviceId[32] = {0};
  char actionName[48] = {0};
  if (!parseActuatorTopic(cmd.topic, topicDeviceId, sizeof(topicDeviceId),
                          actionName, sizeof(actionName))) {
    Serial.printf("[COMMAND] Invalid topic, ignored: %s\n", cmd.topic);
    return;
  }

  if (strcmp(topicDeviceId, DEVICE_ID) != 0) {
    Serial.printf("[COMMAND] Intended for another module (%s), ignored\n", topicDeviceId);
    return;
  }

  char payloadDeviceId[32] = {0};
  char actionId[48] = {0};
  if (!extractJsonStringField(cmd.payload, "actionId", actionId, sizeof(actionId))) {
    Serial.printf("[COMMAND] Missing actionId in message, ignored: %s\n", cmd.payload);
    return;
  }

  if (extractJsonStringField(cmd.payload, "deviceId", payloadDeviceId, sizeof(payloadDeviceId))) {
    if (strcmp(payloadDeviceId, DEVICE_ID) != 0) {
      Serial.printf("[COMMAND] Message deviceId does not match (%s), ignored\n", payloadDeviceId);
      return;
    }
  }

  if (hasSeenActionId(actionId)) {
    Serial.printf("[COMMAND] Already processed (id=%s), ignored\n", actionId);
    return;
  }

  if (!handleActionName(actionName)) {
    Serial.printf("[COMMAND] Unknown action \"%s\" (id=%s) -> rejected\n", actionName, actionId);
    queueAck(actionId, "failed", actionName, "Unknown action");
    return;
  }

  rememberActionId(actionId);
  Serial.printf("[COMMAND] Received from server -> %s (id=%s)\n", describeAction(actionName), actionId);
  queueAck(actionId, "success", actionName, nullptr);
}

void resetRelaysAfterBackup() {
  for (size_t i = 0; i < RELAY_COUNT; i++) setRelay(RELAY_PINS[i], false);
  roofPulseActive = false;
  roofOpenedForHumidity = false;
  Serial.println("[BACKUP] All relays reset to OFF");
}

// Local logic (backup mode, without MQTT), aligned with the database "sensors" table.
void localControlLogic(const LatestSensorData& data) {
  if (data.md02Valid) {
    // Temperature: > 28 -> ventilator_on, < 17 -> ventilator_off
    if (data.temperature > TEMP_MAX_WARNING && !isRelayOn(RELAY_PINS[0])) {
      setRelay(RELAY_PINS[0], true);
      Serial.printf("[BACKUP] Temperature %.1f C > %.1f C -> Fan ON\n",
                    data.temperature, TEMP_MAX_WARNING);
    } else if (data.temperature < TEMP_MIN_WARNING && isRelayOn(RELAY_PINS[0])) {
      setRelay(RELAY_PINS[0], false);
      Serial.printf("[BACKUP] Temperature %.1f C < %.1f C -> Fan OFF\n",
                    data.temperature, TEMP_MIN_WARNING);
    }

    // Humidity: < 62 -> humidifier_on
    if (data.humidity < HUM_MIN_WARNING && !isRelayOn(RELAY_PINS[1])) {
      setRelay(RELAY_PINS[1], true);
      Serial.printf("[BACKUP] Humidity %.1f %% < %.1f %% -> Humidifier ON\n",
                    data.humidity, HUM_MIN_WARNING);
    }

    // Humidity: > 73 -> open_roof (one pulse only; re-enabled when humidity drops below the threshold)
    if (data.humidity > HUM_MAX_WARNING) {
      if (!roofOpenedForHumidity) {
        roofOpenedForHumidity = true;
        startRoofPulse();
        Serial.printf("[BACKUP] Humidity %.1f %% > %.1f %% -> Roof OPENING (pulse)\n",
                      data.humidity, HUM_MAX_WARNING);
      }
      // The database has no "humidifier_off" action: shutoff added as a safety measure (see BACKUP_STOP_ON_HIGH)
      if (BACKUP_STOP_ON_HIGH && isRelayOn(RELAY_PINS[1])) {
        setRelay(RELAY_PINS[1], false);
        Serial.println("[BACKUP] Humidity too high -> Humidifier OFF (safety)");
      }
    } else {
      roofOpenedForHumidity = false;
    }
  }

  if (data.yl69Valid) {
    // Soil: < 20 -> water_pump_on
    if (data.soilMoisturePercent < SOIL_DRY_THRESHOLD && !isRelayOn(RELAY_PINS[2])) {
      setRelay(RELAY_PINS[2], true);
      Serial.printf("[BACKUP] Dry soil (%d %% < %d %%) -> Water pump ON\n",
                    data.soilMoisturePercent, SOIL_DRY_THRESHOLD);
    }
    // Soil: > 80 -> no action in the database; pump shutoff added as a safety measure
    else if (BACKUP_STOP_ON_HIGH && data.soilMoisturePercent > SOIL_WET_THRESHOLD && isRelayOn(RELAY_PINS[2])) {
      setRelay(RELAY_PINS[2], false);
      Serial.printf("[BACKUP] Soil sufficiently moist (%d %% > %d %%) -> Water pump OFF (safety)\n",
                    data.soilMoisturePercent, SOIL_WET_THRESHOLD);
    }
  }
}

void controlTask(void* pvParameters) {
  LatestSensorData latest;
  unsigned long lastXYMD02Read = 0;
  unsigned long lastYL69Read = 0;
  bool firstRun = true;
  bool backupWasActive = false;

  Serial.printf("[CONTROL] started on core %d\n", xPortGetCoreID());

  for (;;) {
    unsigned long now = millis();

    if (firstRun || (now - lastXYMD02Read >= XYMD02_INTERVAL_MS)) {
      lastXYMD02Read = now;
      handleXYMD02(latest);
    }

    if (firstRun || (now - lastYL69Read >= YL69_INTERVAL_MS)) {
      lastYL69Read = now;
      handleYL69(latest);
    }

    firstRun = false;

    if (backupModeActive) {
      if (!backupWasActive) {
        Serial.println("[BACKUP] Local control enabled");
        backupWasActive = true;
      }
      localControlLogic(latest);
    } else if (backupWasActive) {
      Serial.println("[BACKUP] Local control disabled");
      resetRelaysAfterBackup();
      backupWasActive = false;
    }

    CommandMsg cmd;
    while (xQueueReceive(actuatorQueue, &cmd, 0) == pdTRUE) {
      processActuatorCommand(cmd);
    }

    updateRoofPulse();  // switches the roof relay OFF when the pulse ends

    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

// =============================================================================
// Setup / loop
// =============================================================================

void configureWatchdog() {
  // Core 0 (WiFi + TLS) may remain busy for several seconds during a handshake:
  // its IDLE task is therefore no longer monitored. Core 1 (control) remains monitored.
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t wdtConfig = {
    .timeout_ms = 20000,
    .idle_core_mask = (1 << CORE_CONTROL),
    .trigger_panic = true
  };
  if (esp_task_wdt_reconfigure(&wdtConfig) != ESP_OK) {
    esp_task_wdt_init(&wdtConfig);
  }
#else
  disableCore0WDT();
#endif
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=== Smart Farm firmware (MQTT WSS, network=core0 / control=core1) ===");
  Serial.printf("Device ID: %s\n", DEVICE_ID);
  Serial.printf("[BOOT] Last reset reason: %s\n", resetReasonText(esp_reset_reason()));
  Serial.printf("[BOOT] Free heap: %u bytes\n", (unsigned)ESP.getFreeHeap());
  Serial.flush();

  configureWatchdog();

  analogReadResolution(12);
  pinMode(YL69_ANALOG_PIN, INPUT);
  pinMode(YL69_DIGITAL_PIN, INPUT_PULLUP);

  if (RS485_DE_RE_PIN >= 0) {
    pinMode(RS485_DE_RE_PIN, OUTPUT);
    digitalWrite(RS485_DE_RE_PIN, LOW);
    md02.preTransmission(rs485PreTransmission);
    md02.postTransmission(rs485PostTransmission);
  }

  Serial2.begin(MD02_BAUDRATE, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
  md02.begin(MD02_SLAVE_ID, Serial2);
  md02.idle(modbusIdle);

  for (size_t i = 0; i < RELAY_COUNT; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    setRelay(RELAY_PINS[i], false);
  }

  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  updateNetworkLeds(false);

  sensorQueue = xQueueCreate(16, sizeof(SensorMsg));
  actuatorQueue = xQueueCreate(8, sizeof(CommandMsg));
  ackQueue = xQueueCreate(16, sizeof(AckMsg));

  if (!sensorQueue || !actuatorQueue || !ackQueue) {
    Serial.println("[BOOT] ERROR: unable to create queues (memory)");
    return;
  }

  // Network (WiFi + WebSocket + MQTT) on Core 0, control on Core 1
  xTaskCreatePinnedToCore(networkTask, "NetworkTask", 16384, nullptr, 1, nullptr, CORE_NETWORK);
  xTaskCreatePinnedToCore(controlTask, "ControlTask", 8192, nullptr, 1, nullptr, CORE_CONTROL);

  Serial.println("[BOOT] Tasks created");
}

void loop() {
  vTaskDelete(nullptr);
}
