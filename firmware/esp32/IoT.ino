/*
 * ============================================================
 * SMART FARMING - ESP32
 * IOT MODE WITH MANUAL & AUTOMATIC CONTROL
 * FIXED: WiFiManager Hotspot
 * ============================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ============================================================
// PIN CONFIGURATION
// ============================================================

#define TRIG_PIN        18
#define ECHO_PIN        19

#define LDR_PIN         34
#define SOIL_PIN        35

#define DHT_PIN         4
#define DHT_TYPE        DHT22

#define RELAY_PUMP      26
#define RELAY_LAMP      27

#define BUZZER_PIN      23

#define LED_RED         25
#define LED_GREEN       33

#define LCD_SDA         21
#define LCD_SCL         22


// ============================================================
// RELAY LOGIC
// ============================================================

#define RELAY_ON        LOW
#define RELAY_OFF       HIGH


// ============================================================
// SOIL MOISTURE CALIBRATION
// ============================================================

#define ADC_DRY         4095
#define ADC_WET         1700


// ============================================================
// SOIL MOISTURE THRESHOLD
// ============================================================

#define SOIL_PUMP_ON    55
#define SOIL_PUMP_OFF   70


// ============================================================
// LDR THRESHOLD
// ============================================================

#define LDR_ON          2200
#define LDR_OFF         1700


// ============================================================
// WATER TANK
// ============================================================

#define WATER_FULL_DISTANCE     5.0
#define WATER_EMPTY_DISTANCE    17.0
#define WATER_WARNING_LEVEL     20.0


// ============================================================
// MQTT CONFIG
// ============================================================

#define MQTT_BROKER "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_CLIENT_ID "esp32-smartfarm-001"

// Topics
#define TOPIC_SENSOR_TEMP      "smartfarm/sensor/temperature"
#define TOPIC_SENSOR_HUMIDITY  "smartfarm/sensor/humidity"
#define TOPIC_SENSOR_SOIL      "smartfarm/sensor/soil_moisture"
#define TOPIC_SENSOR_WATER     "smartfarm/sensor/water_level"
#define TOPIC_SENSOR_LIGHT     "smartfarm/sensor/light"

#define TOPIC_ACTUATOR_PUMP    "smartfarm/actuator/pump"
#define TOPIC_ACTUATOR_LAMP    "smartfarm/actuator/lamp"
#define TOPIC_ACTUATOR_BUZZER  "smartfarm/actuator/buzzer"

#define TOPIC_CONTROL_PUMP     "smartfarm/control/pump"
#define TOPIC_CONTROL_LAMP     "smartfarm/control/lamp"
#define TOPIC_CONTROL_BUZZER   "smartfarm/control/buzzer"
#define TOPIC_CONTROL_AUTO     "smartfarm/control/auto_mode"
#define TOPIC_CONTROL_QUICK    "smartfarm/control/quick_water"

#define TOPIC_STATUS           "smartfarm/status/esp32"
#define TOPIC_ALL              "smartfarm/all"


// ============================================================
// OBJECTS
// ============================================================

DHT dht(DHT_PIN, DHT_TYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);

WiFiClient espClient;
PubSubClient mqttClient(espClient);
WiFiManager wifiManager;

Preferences prefs;


// ============================================================
// SYSTEM STATE
// ============================================================

// Sensor Values
float temperature = 0;
float humidity = 0;
int soilMoisture = 0;
int soilADC = 0;
float waterLevel = 0;
float distance = 0;
int ldrADC = 0;
String lightStatus = "DAY";

// Actuator States
bool pumpState = false;
bool lampState = false;
bool buzzerState = false;

// System States
bool autoMode = true;
bool alarmState = false;
bool mqttConnected = false;
bool wifiConnected = false;
String systemStatus = "ONLINE";

// Quick Water
bool quickWaterActive = false;
unsigned long quickWaterStart = 0;
int quickWaterDuration = 5;

// Timing
unsigned long lastSensorRead = 0;
unsigned long lastLCDUpdate = 0;
unsigned long lastMQTTPublish = 0;
unsigned long lastLEDBlink = 0;
bool ledState = false;

// Total Water Used
float totalWaterUsed = 0.0;

// Soil Status
String soilStatus = "NORMAL";


// ============================================================
// FUNCTION PROTOTYPES
// ============================================================

float readDistance();
float calculateWaterLevel(float distance);
void readSensors();
void handleAutoMode();
void handleWaterSafety();

void setupWiFi();
void setupMQTT();
void mqttReconnect();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void publishSensorData();
void publishActuatorState(const char* topic, bool state);
void publishStatus();
void publishAll();

void setPump(bool state, bool fromMQTT = false);
void setLamp(bool state, bool fromMQTT = false);
void setBuzzer(bool state, bool fromMQTT = false);
void startQuickWater(int seconds);

void updateLCD();
void updateLEDStatus();
void beep(int times);
void printStatus();
void resetSystem();

void saveState();
void loadState();


// ============================================================
// SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(3000);

  Serial.println("\n================================================");
  Serial.println("          SMART FARMING SYSTEM");
  Serial.println("         IOT MODE v2.0");
  Serial.println("================================================\n");

  // ==========================================================
  // PIN MODE
  // ==========================================================

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);
  pinMode(SOIL_PIN, INPUT);
  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_LAMP, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);

  // ==========================================================
  // ADC RESOLUTION
  // ==========================================================

  analogReadResolution(12);

  // ==========================================================
  // INITIAL OUTPUT
  // ==========================================================

  digitalWrite(RELAY_PUMP, RELAY_OFF);
  digitalWrite(RELAY_LAMP, RELAY_OFF);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, HIGH);

  // ==========================================================
  // I2C & LCD
  // ==========================================================

  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SMART FARMING");
  lcd.setCursor(0, 1);
  lcd.print("BOOTING...");
  delay(2000);

  // ==========================================================
  // DHT22
  // ==========================================================

  dht.begin();
  Serial.println("[OK] DHT22 initialized");

  // ==========================================================
  // LOAD STATE
  // ==========================================================

  loadState();

  // ==========================================================
  // WIFI
  // ==========================================================

  setupWiFi();

  // ==========================================================
  // MQTT
  // ==========================================================

  if (wifiConnected) {
    setupMQTT();
    mqttReconnect();
  }

  // ==========================================================
  // FIRST SENSOR READ
  // ==========================================================

  readSensors();

  // Apply initial states based on sensors
  handleAutoMode();
  handleWaterSafety();

  // ==========================================================
  // STARTUP COMPLETE
  // ==========================================================

  Serial.println("\n[OK] SYSTEM READY!");
  Serial.println("================================================\n");
  Serial.println("COMMANDS:");
  Serial.println("  status      - Show all sensor data");
  Serial.println("  pump on/off - Manual pump control");
  Serial.println("  lamp on/off - Manual lamp control");
  Serial.println("  auto on/off - Toggle auto mode");
  Serial.println("  quick N     - Quick water N seconds");
  Serial.println("  reset       - Reset system");
  Serial.println("================================================\n");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SYSTEM READY");
  lcd.setCursor(0, 1);
  if (wifiConnected) {
    lcd.print("MQTT CONNECTING");
  } else {
    lcd.print("OFFLINE MODE");
  }
  delay(2000);

  beep(2);
}


// ============================================================
// MAIN LOOP
// ============================================================

void loop() {
  unsigned long now = millis();

  // ==========================================================
  // MQTT LOOP
  // ==========================================================

  if (mqttConnected) {
    mqttClient.loop();
  } else if (wifiConnected) {
    static unsigned long lastMQTTRetry = 0;
    if (now - lastMQTTRetry > 10000) {
      lastMQTTRetry = now;
      mqttReconnect();
    }
  }

  // ==========================================================
  // READ SENSORS (every 2 seconds)
  // ==========================================================

  if (now - lastSensorRead >= 2000) {
    lastSensorRead = now;
    readSensors();

    // Handle automation
    if (autoMode) {
      handleAutoMode();
    }

    // Water safety always active
    handleWaterSafety();
  }

  // ==========================================================
  // UPDATE LCD (every 3 seconds)
  // ==========================================================

  if (now - lastLCDUpdate >= 3000) {
    lastLCDUpdate = now;
    updateLCD();
  }

  // ==========================================================
  // PUBLISH MQTT (every 5 seconds)
  // ==========================================================

  if (wifiConnected && (now - lastMQTTPublish >= 5000)) {
    lastMQTTPublish = now;
    if (!mqttClient.connected()) {
      mqttConnected = false;
      mqttReconnect();
    }
    if (mqttConnected) {
      publishAll();
    }
  }

  // ==========================================================
  // QUICK WATER TIMER
  // ==========================================================

  if (quickWaterActive) {
    if (now - quickWaterStart >= (quickWaterDuration * 1000)) {
      setPump(false);
      quickWaterActive = false;
      Serial.println("[QUICK] Watering complete");
    }
  }

  // ==========================================================
  // LED STATUS
  // ==========================================================

  updateLEDStatus();

  // ==========================================================
  // SERIAL COMMANDS
  // ==========================================================

  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toLowerCase();

    if (cmd == "status") {
      printStatus();
    } 
    else if (cmd == "pump on") {
      setPump(true);
      if (autoMode) {
        autoMode = false;
        publishControl(TOPIC_CONTROL_AUTO, "OFF");
        Serial.println("[CMD] Auto mode disabled");
      }
    }
    else if (cmd == "pump off") {
      setPump(false);
      if (autoMode) {
        autoMode = false;
        publishControl(TOPIC_CONTROL_AUTO, "OFF");
        Serial.println("[CMD] Auto mode disabled");
      }
    }
    else if (cmd == "lamp on") {
      setLamp(true);
      if (autoMode) {
        autoMode = false;
        publishControl(TOPIC_CONTROL_AUTO, "OFF");
        Serial.println("[CMD] Auto mode disabled");
      }
    }
    else if (cmd == "lamp off") {
      setLamp(false);
      if (autoMode) {
        autoMode = false;
        publishControl(TOPIC_CONTROL_AUTO, "OFF");
        Serial.println("[CMD] Auto mode disabled");
      }
    }
    else if (cmd == "auto on") {
      autoMode = true;
      publishControl(TOPIC_CONTROL_AUTO, "ON");
      Serial.println("[CMD] Auto mode ENABLED");
    }
    else if (cmd == "auto off") {
      autoMode = false;
      publishControl(TOPIC_CONTROL_AUTO, "OFF");
      Serial.println("[CMD] Auto mode DISABLED");
    }
    else if (cmd.startsWith("quick ")) {
      int sec = cmd.substring(6).toInt();
      if (sec > 0 && sec <= 60) {
        startQuickWater(sec);
      } else {
        Serial.println("[CMD] Invalid duration (1-60s)");
      }
    }
    else if (cmd == "reset") {
      resetSystem();
    }
    else if (cmd == "help") {
      Serial.println("\nCOMMANDS:");
      Serial.println("  status        - Show all sensor data");
      Serial.println("  pump on/off   - Manual pump control");
      Serial.println("  lamp on/off   - Manual lamp control");
      Serial.println("  auto on/off   - Toggle auto mode");
      Serial.println("  quick N       - Quick water N seconds");
      Serial.println("  reset         - Reset system");
      Serial.println("  help          - Show this help");
    }
    else {
      Serial.printf("[CMD] Unknown: %s\n", cmd.c_str());
    }
  }

  delay(50);
}


// ============================================================
// SENSOR FUNCTIONS
// ============================================================

float readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    return -1;
  }

  return duration * 0.0343 / 2.0;
}

float calculateWaterLevel(float distance) {
  if (distance < 0) return -1;
  if (distance <= WATER_FULL_DISTANCE) return 100.0;
  if (distance >= WATER_EMPTY_DISTANCE) return 0.0;

  float level = ((WATER_EMPTY_DISTANCE - distance) / 
                 (WATER_EMPTY_DISTANCE - WATER_FULL_DISTANCE)) * 100.0;

  return constrain(level, 0.0, 100.0);
}

void readSensors() {
  // ==========================================================
  // DHT22
  // ==========================================================

  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  if (!isnan(temp) && !isnan(hum)) {
    temperature = temp;
    humidity = hum;
  } else {
    Serial.println("[DHT] Read error!");
  }

  // ==========================================================
  // SOIL MOISTURE
  // ==========================================================

  soilADC = analogRead(SOIL_PIN);
  soilMoisture = map(soilADC, ADC_DRY, ADC_WET, 0, 100);
  soilMoisture = constrain(soilMoisture, 0, 100);

  // Soil status
  if (soilMoisture < SOIL_PUMP_ON) {
    soilStatus = "KERING";
  } else if (soilMoisture < SOIL_PUMP_OFF) {
    soilStatus = "NORMAL";
  } else {
    soilStatus = "BASAH";
  }

  // ==========================================================
  // ULTRASONIC WATER LEVEL
  // ==========================================================

  distance = readDistance();
  waterLevel = calculateWaterLevel(distance);

  // ==========================================================
  // LDR
  // ==========================================================

  ldrADC = analogRead(LDR_PIN);
  lightStatus = (ldrADC >= LDR_ON) ? "NIGHT" : "DAY";
}


// ============================================================
// ACTUATOR CONTROL
// ============================================================

void setPump(bool state, bool fromMQTT) {
  if (pumpState == state) return;

  // Check water safety
  if (state && waterLevel >= 0 && waterLevel <= WATER_WARNING_LEVEL) {
    Serial.println("[SAFETY] Cannot turn ON pump - water level critical!");
    // Send feedback via MQTT
    if (mqttConnected) {
      mqttClient.publish("smartfarm/feedback/pump", "SAFETY_BLOCKED");
    }
    return;
  }

  pumpState = state;
  digitalWrite(RELAY_PUMP, state ? RELAY_ON : RELAY_OFF);

  // Track water usage
  if (state) {
    totalWaterUsed += 0.1;
    saveState();
  }

  Serial.printf("[PUMP] %s %s\n", 
    state ? "ON" : "OFF",
    fromMQTT ? "(via MQTT)" : "");

  // Publish state
  if (mqttConnected) {
    publishActuatorState(TOPIC_ACTUATOR_PUMP, state);
  }
}

void setLamp(bool state, bool fromMQTT) {
  if (lampState == state) return;

  lampState = state;
  digitalWrite(RELAY_LAMP, state ? RELAY_ON : RELAY_OFF);

  Serial.printf("[LAMP] %s %s\n",
    state ? "ON" : "OFF",
    fromMQTT ? "(via MQTT)" : "");

  if (mqttConnected) {
    publishActuatorState(TOPIC_ACTUATOR_LAMP, state);
  }
}

void setBuzzer(bool state, bool fromMQTT) {
  if (buzzerState == state) return;

  buzzerState = state;
  digitalWrite(BUZZER_PIN, state ? HIGH : LOW);

  Serial.printf("[BUZZER] %s %s\n",
    state ? "ON" : "OFF",
    fromMQTT ? "(via MQTT)" : "");

  if (mqttConnected) {
    publishActuatorState(TOPIC_ACTUATOR_BUZZER, state);
  }
}

void startQuickWater(int seconds) {
  if (seconds <= 0) return;

  // Check water safety
  if (waterLevel >= 0 && waterLevel <= WATER_WARNING_LEVEL) {
    Serial.println("[SAFETY] Cannot start quick water - water level critical!");
    if (mqttConnected) {
      mqttClient.publish("smartfarm/feedback/quick_water", "SAFETY_BLOCKED");
    }
    return;
  }

  quickWaterActive = true;
  quickWaterStart = millis();
  quickWaterDuration = seconds;
  setPump(true);

  Serial.printf("[QUICK] Watering for %d seconds\n", seconds);
  
  if (mqttConnected) {
    mqttClient.publish("smartfarm/feedback/quick_water", "STARTED");
  }
}


// ============================================================
// AUTOMATION LOGIC
// ============================================================

void handleAutoMode() {
  // ==========================================================
  // 1. SOIL MOISTURE → PUMP
  // ==========================================================

  if (waterLevel >= 0 && waterLevel > WATER_WARNING_LEVEL) {
    if (soilMoisture < SOIL_PUMP_ON && !pumpState) {
      setPump(true);
      Serial.println("[AUTO] Soil dry -> Pump ON");
    } else if (soilMoisture >= SOIL_PUMP_OFF && pumpState) {
      setPump(false);
      Serial.println("[AUTO] Soil wet -> Pump OFF");
    }
  }

  // ==========================================================
  // 2. LDR → LAMP
  // ==========================================================

  if (ldrADC >= LDR_ON && !lampState) {
    setLamp(true);
    Serial.println("[AUTO] Dark -> Lamp ON");
  } else if (ldrADC <= LDR_OFF && lampState) {
    setLamp(false);
    Serial.println("[AUTO] Bright -> Lamp OFF");
  }
}

void handleWaterSafety() {
  // ==========================================================
  // WATER LEVEL SAFETY - HIGHEST PRIORITY
  // ==========================================================

  bool previousAlarm = alarmState;

  if (waterLevel >= 0 && waterLevel <= WATER_WARNING_LEVEL) {
    alarmState = true;

    // Force pump OFF
    if (pumpState) {
      setPump(false);
      Serial.println("[SAFETY] Pump forced OFF - water critical!");
    }

    // Turn on buzzer
    if (!buzzerState) {
      setBuzzer(true);
    }

    systemStatus = "WARNING";

  } else if (waterLevel < 0) {
    alarmState = true;
    systemStatus = "SENSOR ERROR";

  } else {
    alarmState = false;
    if (buzzerState) {
      setBuzzer(false);
    }
    if (systemStatus == "WARNING" || systemStatus == "SENSOR ERROR") {
      systemStatus = "ONLINE";
    }
  }

  // If alarm state changed
  if (alarmState != previousAlarm) {
    Serial.printf("[ALARM] %s\n", alarmState ? "ACTIVE - WATER LOW!" : "CLEAR");
  }
}


// ============================================================
// MQTT FUNCTIONS
// ============================================================

void setupWiFi() {
  Serial.println("[WIFI] Starting WiFiManager...");
  Serial.println("[WIFI] Jika gagal, akan membuat hotspot 'SmartFarm'");
  Serial.println("[WIFI] Password: 12345678");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Setup");
  lcd.setCursor(0, 1);
  lcd.print("Hotspot:SmartFarm");

  // ==========================================================
  // RESET SETTINGS - UNCOMMENT IF NEEDED
  // ==========================================================
  // wifiManager.resetSettings();

  // ==========================================================
  // CONFIGURE WIFIMANAGER
  // ==========================================================
  
  // Set timeout untuk config portal (60 detik)
  wifiManager.setConfigPortalTimeout(60);
  
  // Set timeout untuk koneksi WiFi (30 detik)
  wifiManager.setConnectTimeout(30);
  
  // Debug output
  wifiManager.setDebugOutput(true);

  // ==========================================================
  // AUTO CONNECT
  // ==========================================================
  
  // Mencoba koneksi ke WiFi yang sudah disimpan
  // Jika gagal, membuat hotspot
  bool connected = wifiManager.autoConnect("SmartFarm", "12345678");

  if (connected) {
    wifiConnected = true;
    Serial.println("[WIFI] ✅ Connected!");
    Serial.printf("[WIFI] SSID: %s\n", WiFi.SSID().c_str());
    Serial.printf("[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi OK!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
    delay(2000);

  } else {
    wifiConnected = false;
    Serial.println("[WIFI] ❌ Timeout - OFFLINE mode");
    Serial.println("[WIFI] ESP32 berjalan dalam mode OFFLINE");
    Serial.println("[WIFI] Restart ESP32 untuk mencoba koneksi lagi");

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi OFFLINE");
    lcd.setCursor(0, 1);
    lcd.print("Local Mode");
    delay(3000);
  }
}

void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(30);
}

void mqttReconnect() {
  if (mqttClient.connected()) return;
  if (!wifiConnected) return;

  Serial.print("[MQTT] Connecting...");
  bool ok = mqttClient.connect(MQTT_CLIENT_ID);

  if (ok) {
    mqttConnected = true;
    Serial.println(" ✅ Connected!");

    // Subscribe to control topics
    mqttClient.subscribe(TOPIC_CONTROL_PUMP);
    mqttClient.subscribe(TOPIC_CONTROL_LAMP);
    mqttClient.subscribe(TOPIC_CONTROL_BUZZER);
    mqttClient.subscribe(TOPIC_CONTROL_AUTO);
    mqttClient.subscribe(TOPIC_CONTROL_QUICK);

    Serial.println("[MQTT] Subscribed to control topics");

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("MQTT Connected");
    delay(1000);

    // Publish initial state
    publishAll();

  } else {
    mqttConnected = false;
    Serial.printf(" ❌ Failed! rc=%d\n", mqttClient.state());
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';

  String topicStr = String(topic);
  String msgStr = String(message);

  Serial.printf("[MQTT] %s -> %s\n", topic, message);

  // ==========================================================
  // CONTROL PUMP
  // ==========================================================

  if (topicStr == TOPIC_CONTROL_PUMP) {
    bool state = (msgStr == "ON" || msgStr == "1");

    // Check water safety
    if (state && waterLevel >= 0 && waterLevel <= WATER_WARNING_LEVEL) {
      Serial.println("[MQTT] Cannot turn ON pump - water level critical!");
      // Send feedback
      mqttClient.publish("smartfarm/feedback/pump", "SAFETY_BLOCKED");
      return;
    }

    setPump(state, true);

    // If in auto mode and manual control, disable auto
    if (autoMode) {
      autoMode = false;
      mqttClient.publish(TOPIC_CONTROL_AUTO, "OFF");
      Serial.println("[MQTT] Auto mode disabled (manual override)");
    }
  }

  // ==========================================================
  // CONTROL LAMP
  // ==========================================================

  else if (topicStr == TOPIC_CONTROL_LAMP) {
    bool state = (msgStr == "ON" || msgStr == "1");
    setLamp(state, true);

    if (autoMode) {
      autoMode = false;
      mqttClient.publish(TOPIC_CONTROL_AUTO, "OFF");
      Serial.println("[MQTT] Auto mode disabled (manual override)");
    }
  }

  // ==========================================================
  // CONTROL BUZZER
  // ==========================================================

  else if (topicStr == TOPIC_CONTROL_BUZZER) {
    bool state = (msgStr == "ON" || msgStr == "1");
    setBuzzer(state, true);
  }

  // ==========================================================
  // CONTROL AUTO MODE
  // ==========================================================

  else if (topicStr == TOPIC_CONTROL_AUTO) {
    autoMode = (msgStr == "ON" || msgStr == "1" || msgStr == "AUTO");
    Serial.printf("[MQTT] Auto mode: %s\n", autoMode ? "ENABLED" : "DISABLED");

    // Re-apply automation if enabled
    if (autoMode) {
      handleAutoMode();
    }
  }

  // ==========================================================
  // CONTROL QUICK WATER
  // ==========================================================

  else if (topicStr == TOPIC_CONTROL_QUICK) {
    int seconds = msgStr.toInt();
    if (seconds > 0 && seconds <= 60) {
      startQuickWater(seconds);
    } else {
      Serial.printf("[MQTT] Invalid quick water duration: %d\n", seconds);
      mqttClient.publish("smartfarm/feedback/quick_water", "INVALID_DURATION");
    }
  }
}

void publishAll() {
  if (!mqttConnected) return;

  publishSensorData();
  publishStatus();

  // Publish actuator states
  publishActuatorState(TOPIC_ACTUATOR_PUMP, pumpState);
  publishActuatorState(TOPIC_ACTUATOR_LAMP, lampState);
  publishActuatorState(TOPIC_ACTUATOR_BUZZER, buzzerState);

  Serial.println("[MQTT] All data published");
}

void publishSensorData() {
  char buffer[16];

  // Temperature
  dtostrf(temperature, 4, 1, buffer);
  mqttClient.publish(TOPIC_SENSOR_TEMP, buffer);

  // Humidity
  dtostrf(humidity, 4, 1, buffer);
  mqttClient.publish(TOPIC_SENSOR_HUMIDITY, buffer);

  // Soil Moisture
  sprintf(buffer, "%d", soilMoisture);
  mqttClient.publish(TOPIC_SENSOR_SOIL, buffer);

  // Water Level
  if (waterLevel >= 0) {
    sprintf(buffer, "%.0f", waterLevel);
  } else {
    sprintf(buffer, "-1");
  }
  mqttClient.publish(TOPIC_SENSOR_WATER, buffer);

  // Light Status
  mqttClient.publish(TOPIC_SENSOR_LIGHT, lightStatus.c_str());
}

void publishActuatorState(const char* topic, bool state) {
  mqttClient.publish(topic, state ? "ON" : "OFF");
}

void publishControl(const char* topic, const char* value) {
  if (mqttConnected) {
    mqttClient.publish(topic, value);
  }
}

void publishStatus() {
  if (!mqttConnected) return;

  StaticJsonDocument<512> doc;

  // Sensor Data
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["soil_moisture"] = soilMoisture;
  doc["soil_status"] = soilStatus;
  doc["water_level"] = waterLevel >= 0 ? waterLevel : -1;
  doc["light"] = lightStatus;
  doc["ldr_adc"] = ldrADC;
  doc["soil_adc"] = soilADC;

  // Actuator States
  doc["pump"] = pumpState ? "ON" : "OFF";
  doc["lamp"] = lampState ? "ON" : "OFF";
  doc["buzzer"] = buzzerState ? "ON" : "OFF";

  // System
  doc["mode"] = autoMode ? "AUTO" : "MANUAL";
  doc["status"] = systemStatus;
  doc["alarm"] = alarmState;
  doc["uptime"] = millis() / 1000;
  doc["water_used"] = totalWaterUsed;
  doc["wifi"] = wifiConnected;
  doc["mqtt"] = mqttConnected;

  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);

  mqttClient.publish(TOPIC_STATUS, jsonBuffer);
}


// ============================================================
// LCD DISPLAY
// ============================================================

void updateLCD() {
  lcd.clear();

  // ==========================================================
  // LINE 1: Temperature + Humidity
  // ==========================================================

  lcd.setCursor(0, 0);

  if (!isnan(temperature)) {
    lcd.print("T:");
    lcd.print(temperature, 1);
    lcd.print("C ");
  } else {
    lcd.print("T:ERR ");
  }

  if (!isnan(humidity)) {
    lcd.print("H:");
    lcd.print(humidity, 0);
    lcd.print("%");
  } else {
    lcd.print("H:ERR");
  }

  // ==========================================================
  // LINE 2: Water + Pump + Mode
  // ==========================================================

  lcd.setCursor(0, 1);

  if (waterLevel >= 0) {
    lcd.print("W:");
    lcd.print(waterLevel, 0);
    lcd.print("% ");
  } else {
    lcd.print("W:ERR ");
  }

  lcd.print("P:");
  lcd.print(pumpState ? "ON " : "OFF");

  // Show mode indicator
  if (alarmState) {
    lcd.print("!");
  } else {
    lcd.print(autoMode ? "A" : "M");
  }
}


// ============================================================
// LED STATUS
// ============================================================

void updateLEDStatus() {
  if (alarmState) {
    // Alarm: LED Red blinking fast
    if (millis() - lastLEDBlink > 500) {
      lastLEDBlink = millis();
      ledState = !ledState;
      digitalWrite(LED_RED, ledState ? HIGH : LOW);
      digitalWrite(LED_GREEN, LOW);
    }
  } else if (wifiConnected && mqttConnected) {
    // Normal: LED Green slow blink
    if (millis() - lastLEDBlink > 2000) {
      lastLEDBlink = millis();
      ledState = !ledState;
      digitalWrite(LED_GREEN, ledState ? HIGH : LOW);
      digitalWrite(LED_RED, LOW);
    }
  } else if (wifiConnected) {
    // WiFi OK, MQTT error: Yellow (both LEDs)
    if (millis() - lastLEDBlink > 500) {
      lastLEDBlink = millis();
      ledState = !ledState;
      digitalWrite(LED_GREEN, ledState ? HIGH : LOW);
      digitalWrite(LED_RED, ledState ? HIGH : LOW);
    }
  } else {
    // WiFi error: LED Red slow blink
    if (millis() - lastLEDBlink > 1000) {
      lastLEDBlink = millis();
      ledState = !ledState;
      digitalWrite(LED_RED, ledState ? HIGH : LOW);
      digitalWrite(LED_GREEN, LOW);
    }
  }
}


// ============================================================
// PREFERENCES (Save/Load State)
// ============================================================

void saveState() {
  prefs.begin("smartfarm", false);
  prefs.putFloat("water", totalWaterUsed);
  prefs.end();
}

void loadState() {
  prefs.begin("smartfarm", true);
  totalWaterUsed = prefs.getFloat("water", 0.0);
  prefs.end();
  Serial.printf("[STATE] Water used: %.2f L\n", totalWaterUsed);
}


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

void beep(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

void printStatus() {
  Serial.println("\n╔═══════════════════════════════════════╗");
  Serial.println("║ SMART FARMING STATUS                ║");
  Serial.println("╠═══════════════════════════════════════╣");

  // Sensors
  Serial.printf("║ Temperature : %6.1f °C             ║\n", temperature);
  Serial.printf("║ Humidity    : %6.1f %%             ║\n", humidity);
  Serial.printf("║ Soil ADC    : %6d                 ║\n", soilADC);
  Serial.printf("║ Soil Moist. : %6d %% (%s)  ║\n", soilMoisture, soilStatus.c_str());
  Serial.printf("║ LDR ADC     : %6d                 ║\n", ldrADC);
  Serial.printf("║ Light       : %6s               ║\n", lightStatus.c_str());
  Serial.printf("║ Water Dist. : %6.2f cm            ║\n", distance);
  Serial.printf("║ Water Level : %6.1f %%             ║\n", waterLevel);

  Serial.println("╠═══════════════════════════════════════╣");

  // Actuators
  Serial.printf("║ Pump        : %6s               ║\n", pumpState ? "ON" : "OFF");
  Serial.printf("║ Lamp        : %6s               ║\n", lampState ? "ON" : "OFF");
  Serial.printf("║ Buzzer      : %6s               ║\n", buzzerState ? "ON" : "OFF");

  Serial.println("╠═══════════════════════════════════════╣");

  // System
  Serial.printf("║ Mode        : %6s               ║\n", autoMode ? "AUTO" : "MANUAL");
  Serial.printf("║ Status      : %6s               ║\n", systemStatus.c_str());
  Serial.printf("║ Alarm       : %6s               ║\n", alarmState ? "ACTIVE" : "CLEAR");
  Serial.printf("║ Water Used  : %8.2f L             ║\n", totalWaterUsed);

  Serial.println("╠═══════════════════════════════════════╣");

  // Connectivity
  Serial.printf("║ WiFi        : %s                ║\n", wifiConnected ? "Connected" : "Offline");
  Serial.printf("║ MQTT        : %s                ║\n", mqttConnected ? "Connected" : "Disconnected");
  Serial.printf("║ Uptime      : %lu s            ║\n", millis() / 1000);

  Serial.println("╚═══════════════════════════════════════╝\n");
}

void resetSystem() {
  Serial.println("[SYSTEM] Resetting...");
  delay(1000);
  ESP.restart();
}
