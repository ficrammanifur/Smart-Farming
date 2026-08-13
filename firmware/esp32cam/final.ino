/*
 * ============================================================
 * ESP32-CAM - SMART FARMING CAMERA MODULE
 * WiFiManager + MQTT (Command) + HTTP (Image)
 * ============================================================
 * 
 * FITUR:
 * - MQTT hanya untuk command (capture) dan status
 * - Gambar dikirim via HTTP ke dashboard
 * - Flash ON untuk capture
 * ============================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ============================================================
// PIN DEFINISI (AI-Thinker ESP32-CAM)
// ============================================================

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5

#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define FLASH_LED_PIN     4

// ============================================================
// MQTT CONFIG
// ============================================================

#define MQTT_BROKER "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_CLIENT_ID "esp32-cam-001"

#define TOPIC_CAMERA_CAPTURE   "smartfarm/camera/capture"
#define TOPIC_CAMERA_RESPONSE  "smartfarm/camera/response"
#define TOPIC_CAMERA_STATUS    "smartfarm/camera/status"

// ============================================================
// OBJECTS
// ============================================================

WebServer server(80);
WiFiClient espClient;
PubSubClient mqttClient(espClient);
WiFiManager wifiManager;

// ============================================================
// SYSTEM STATE
// ============================================================

bool wifiConnected = false;
bool mqttConnected = false;
bool cameraReady = false;
bool captureInProgress = false;

String lastImageUrl = "";

// ============================================================
// HTML PAGE
// ============================================================

const char MAIN_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ESP32-CAM Smart Farming</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #0a0e1a;
      color: #e0e0e0;
      text-align: center;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .card {
      max-width: 600px;
      width: 100%;
      margin: auto;
      background: linear-gradient(145deg, #141b2d, #1a2335);
      padding: 25px;
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.05);
    }
    h2 {
      margin: 0 0 5px 0;
      font-weight: 600;
      font-size: 1.5rem;
      background: linear-gradient(135deg, #10b981, #34d399);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: #6b7280;
      font-size: 0.85rem;
      margin-bottom: 20px;
    }
    #photo {
      width: 100%;
      max-width: 500px;
      border-radius: 12px;
      display: none;
      margin: 15px 0;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .btn-group {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      margin: 15px 0;
    }
    button {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s;
      flex: 1;
      min-width: 120px;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    }
    button:active {
      transform: scale(0.97);
    }
    button.btn-flash {
      background: linear-gradient(135deg, #f59e0b, #d97706);
    }
    button.btn-flash.active {
      background: linear-gradient(135deg, #10b981, #059669);
    }
    #status {
      margin-top: 15px;
      padding: 10px;
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
      color: #9ca3af;
      font-size: 0.9rem;
    }
    #status.success { color: #34d399; }
    #status.error { color: #ef4444; }
    #status.loading { color: #f59e0b; }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    .badge.online { background: rgba(16,185,129,0.2); color: #10b981; }
    .badge.offline { background: rgba(239,68,68,0.2); color: #ef4444; }
    .badge.mqtt { background: rgba(56,189,248,0.2); color: #38bdf8; }
  </style>
</head>
<body>
<div class="card">
  <h2>📷 Smart Farming CAM</h2>
  <p class="subtitle">ESP32-CAM • MQTT Command + HTTP Image</p>
  <div class="btn-group">
    <button onclick="ambilGambar()">📸 Capture</button>
    <button class="btn-flash" id="flashBtn" onclick="toggleFlash()">💡 Flash</button>
  </div>
  <img id="photo">
  <div id="status">📡 Tekan tombol untuk mengambil gambar</div>
  <div class="info-row">
    <span>📡 MQTT: <span class="badge mqtt" id="mqttStatus">ONLINE</span></span>
    <span>📷 CAM: <span class="badge online" id="camStatus">READY</span></span>
    <span id="timeStamp">⏱️ --:--:--</span>
  </div>
</div>
<script>
  let flashState = false;
  const photo = document.getElementById("photo");
  const status = document.getElementById("status");

  function setStatus(msg, type = '') {
    status.textContent = msg;
    status.className = type;
  }

  function ambilGambar() {
    setStatus("📸 Mengambil gambar...", "loading");
    photo.style.display = "none";
    const timestamp = new Date().getTime();
    photo.src = "/capture?t=" + timestamp;
    photo.onload = function() {
      photo.style.display = "block";
      setStatus("✅ Gambar berhasil diambil", "success");
      document.getElementById("timeStamp").textContent = "⏱️ " + new Date().toLocaleTimeString();
    };
    photo.onerror = function() {
      setStatus("❌ Gagal mengambil gambar", "error");
    };
  }

  function toggleFlash() {
    flashState = !flashState;
    const btn = document.getElementById("flashBtn");
    if (flashState) {
      btn.textContent = "🔦 Flash ON";
      btn.classList.add("active");
      fetch("/flash?state=on");
    } else {
      btn.textContent = "💡 Flash";
      btn.classList.remove("active");
      fetch("/flash?state=off");
    }
  }

  setInterval(() => {
    fetch("/status")
      .then(res => res.json())
      .then(data => {
        document.getElementById("mqttStatus").textContent = data.mqtt ? "ONLINE" : "OFFLINE";
        document.getElementById("mqttStatus").className = "badge " + (data.mqtt ? "mqtt" : "offline");
        document.getElementById("camStatus").textContent = data.camera ? "READY" : "ERROR";
        document.getElementById("camStatus").className = "badge " + (data.camera ? "online" : "offline");
      })
      .catch(() => {});
  }, 5000);
</script>
</body>
</html>
)rawliteral";

// ============================================================
// FUNCTION PROTOTYPES
// ============================================================

void initCamera();
void handleRoot();
void handleCapture();
void handleFlash();
void handleStatus();
void setupWiFi();
void setupMQTT();
void mqttReconnect();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void captureAndSendImage();
void publishStatus(String status, String message);
void publishResponse(String message);
void printStatus();

// ============================================================
// SETUP
// ============================================================

void setup() {
    Serial.begin(115200);
    delay(3000);

    Serial.println("\n================================================");
    Serial.println("       ESP32-CAM SMART FARMING");
    Serial.println("    MQTT Command + HTTP Image");
    Serial.println("================================================\n");

    pinMode(FLASH_LED_PIN, OUTPUT);
    digitalWrite(FLASH_LED_PIN, LOW);

    Serial.println("[CAMERA] Initializing...");
    initCamera();
    
    if (cameraReady) {
        Serial.println("[CAMERA] ✅ Ready!");
    } else {
        Serial.println("[CAMERA] ❌ Failed to initialize!");
    }

    setupWiFi();

    if (wifiConnected) {
        server.on("/", HTTP_GET, handleRoot);
        server.on("/capture", HTTP_GET, handleCapture);
        server.on("/flash", HTTP_GET, handleFlash);
        server.on("/status", HTTP_GET, handleStatus);
        server.begin();
        Serial.println("[SERVER] Web server aktif");
        Serial.print("[SERVER] Buka browser: http://");
        Serial.println(WiFi.localIP());
    }

    if (wifiConnected) {
        setupMQTT();
        mqttReconnect();
    }

    if (mqttConnected) {
        publishStatus("ONLINE", "Camera ready");
        publishResponse("SYSTEM_READY");
    }

    Serial.println("\n[OK] SYSTEM READY!");
    Serial.println("================================================\n");
    Serial.println("COMMANDS (via Serial):");
    Serial.println("  capture - Take a photo");
    Serial.println("  flash on/off - Turn flash ON/OFF");
    Serial.println("  status  - Show system status");
    Serial.println("  reset   - Reset system");
    Serial.println("================================================\n");
}

// ============================================================
// MAIN LOOP
// ============================================================

void loop() {
    unsigned long now = millis();

    if (wifiConnected) {
        server.handleClient();
    }

    if (mqttConnected) {
        mqttClient.loop();
    } else if (wifiConnected) {
        static unsigned long lastMQTTRetry = 0;
        if (now - lastMQTTRetry > 10000) {
            lastMQTTRetry = now;
            mqttReconnect();
        }
    }

    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        cmd.toLowerCase();

        if (cmd == "capture") {
            Serial.println("[CMD] Capturing...");
            captureAndSendImage();
        }
        else if (cmd == "flash on") {
            digitalWrite(FLASH_LED_PIN, HIGH);
            Serial.println("[CMD] Flash ON");
        }
        else if (cmd == "flash off") {
            digitalWrite(FLASH_LED_PIN, LOW);
            Serial.println("[CMD] Flash OFF");
        }
        else if (cmd == "status") {
            printStatus();
        }
        else if (cmd == "reset") {
            Serial.println("[SYSTEM] Resetting...");
            delay(1000);
            ESP.restart();
        }
        else if (cmd == "help") {
            Serial.println("\nCOMMANDS:");
            Serial.println("  capture     - Take a photo (via HTTP)");
            Serial.println("  flash on/off - Turn flash ON/OFF");
            Serial.println("  status      - Show system status");
            Serial.println("  reset       - Reset system");
            Serial.println("  help        - Show this help");
        }
        else {
            Serial.printf("[CMD] Unknown: %s\n", cmd.c_str());
        }
    }

    delay(100);
}

// ============================================================
// CAMERA FUNCTIONS
// ============================================================

void initCamera() {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

    if (psramFound()) {
        Serial.println("[CAMERA] PSRAM detected");
        config.frame_size = FRAMESIZE_VGA;
        config.jpeg_quality = 10;
        config.fb_count = 2;
        config.grab_mode = CAMERA_GRAB_LATEST;
        config.fb_location = CAMERA_FB_IN_PSRAM;
    } else {
        Serial.println("[CAMERA] PSRAM NOT detected");
        config.frame_size = FRAMESIZE_VGA;
        config.jpeg_quality = 12;
        config.fb_count = 1;
        config.fb_location = CAMERA_FB_IN_DRAM;
    }

    esp_err_t err = esp_camera_init(&config);

    if (err != ESP_OK) {
        Serial.printf("[CAMERA] Init failed! Error: 0x%x\n", err);
        cameraReady = false;
        return;
    }

    Serial.println("[CAMERA] esp_camera_init() SUCCESS");

    sensor_t *s = esp_camera_sensor_get();
    if (s == NULL) {
        Serial.println("[CAMERA] Sensor NULL!");
        cameraReady = false;
        return;
    }

    Serial.printf("[CAMERA] Sensor PID: 0x%02X\n", s->id.PID);

    // ==========================================================
    // SETTING SENSOR - AUTO EXPOSURE & GAIN ON
    // ==========================================================

    s->set_brightness(s, 1);
    s->set_contrast(s, 0);
    s->set_saturation(s, 0);
    
    s->set_ae_level(s, 1);
    s->set_aec2(s, 1);
    
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    
    s->set_gain_ctrl(s, 1);
    s->set_exposure_ctrl(s, 1);

    if (s->id.PID == OV3660_PID) {
        s->set_vflip(s, 1);
    }

    cameraReady = true;
    Serial.println("[CAMERA] Camera READY!");
}

// ============================================================
// CAPTURE AND SEND IMAGE - VIA HTTP (BUKAN MQTT)
// ============================================================

void captureAndSendImage() {
    if (!cameraReady) {
        Serial.println("[CAMERA] Not ready!");
        return;
    }

    if (captureInProgress) {
        Serial.println("[CAMERA] Capture in progress!");
        return;
    }

    captureInProgress = true;
    publishResponse("CAPTURING");

    // ==========================================================
    // 1. FLASH ON
    // ==========================================================
    
    Serial.println("[CAMERA] Flash ON");
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(700);

    // ==========================================================
    // 2. BUANG FRAME PERTAMA
    // ==========================================================
    
    camera_fb_t *fb_dummy = esp_camera_fb_get();
    if (fb_dummy) {
        Serial.printf("[CAMERA] Dummy frame: %zu bytes\n", fb_dummy->len);
        esp_camera_fb_return(fb_dummy);
    }
    
    delay(200);

    // ==========================================================
    // 3. CAPTURE FRAME UTAMA
    // ==========================================================
    
    camera_fb_t *fb = esp_camera_fb_get();
    
    digitalWrite(FLASH_LED_PIN, LOW);
    Serial.println("[CAMERA] Flash OFF");

    if (!fb) {
        Serial.println("[CAMERA] Failed to capture!");
        captureInProgress = false;
        publishStatus("ERROR", "Failed to capture image");
        publishResponse("ERROR");
        return;
    }

    Serial.printf("[CAMERA] Captured! Size: %zu bytes\n", fb->len);
    esp_camera_fb_return(fb);

    // ==========================================================
    // 4. KIRIM RESPONSE VIA MQTT (TANPA GAMBAR)
    // ==========================================================
    
    if (mqttConnected) {
        // Kirim URL gambar
        String imageUrl = "http://" + WiFi.localIP().toString() + "/capture";
        publishStatus("OK", "Image ready: " + imageUrl);
        publishResponse("DONE");
        Serial.printf("[MQTT] Image ready: %s\n", imageUrl.c_str());
    }

    captureInProgress = false;
}

// ============================================================
// WEB SERVER HANDLERS
// ============================================================

void handleRoot() {
    server.send_P(200, "text/html", MAIN_PAGE);
}

void handleCapture() {
    if (!cameraReady) {
        server.send(500, "text/plain", "Camera not ready");
        return;
    }

    // ==========================================================
    // FLASH + DUMMY FRAME UNTUK WEB
    // ==========================================================
    
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(700);

    camera_fb_t *dummy = esp_camera_fb_get();
    if (dummy) {
        esp_camera_fb_return(dummy);
    }
    
    delay(200);

    camera_fb_t *fb = esp_camera_fb_get();
    
    digitalWrite(FLASH_LED_PIN, LOW);

    if (!fb) {
        Serial.println("❌ Camera capture failed");
        server.send(500, "text/plain", "Camera capture failed");
        return;
    }

    Serial.printf("📸 Foto berhasil diambil: %zu bytes\n", fb->len);
    server.send_P(200, "image/jpeg", (const char*)fb->buf, fb->len);
    esp_camera_fb_return(fb);
}

void handleFlash() {
    String state = server.arg("state");
    if (state == "on") {
        digitalWrite(FLASH_LED_PIN, HIGH);
        server.send(200, "text/plain", "Flash ON");
    } else if (state == "off") {
        digitalWrite(FLASH_LED_PIN, LOW);
        server.send(200, "text/plain", "Flash OFF");
    } else {
        server.send(400, "text/plain", "Invalid state");
    }
}

void handleStatus() {
    StaticJsonDocument<128> doc;
    doc["camera"] = cameraReady;
    doc["mqtt"] = mqttConnected;
    doc["wifi"] = wifiConnected;
    doc["uptime"] = millis() / 1000;
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

// ============================================================
// WIFI FUNCTIONS
// ============================================================

void setupWiFi() {
    Serial.println("[WIFI] Starting WiFiManager...");
    Serial.println("[WIFI] Jika gagal, buka hotspot 'SmartFarm-CAM'");
    Serial.println("[WIFI] Password: 12345678");

    wifiManager.setConfigPortalTimeout(60);
    wifiManager.setConnectTimeout(30);
    wifiManager.setDebugOutput(true);

    bool connected = wifiManager.autoConnect("SmartFarm-CAM", "12345678");

    if (connected) {
        wifiConnected = true;
        Serial.println("[WIFI] ✅ Connected!");
        Serial.printf("[WIFI] SSID: %s\n", WiFi.SSID().c_str());
        Serial.printf("[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        wifiConnected = false;
        Serial.println("[WIFI] ❌ Timeout - OFFLINE mode");
    }
}

// ============================================================
// MQTT FUNCTIONS
// ============================================================

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
        mqttClient.subscribe(TOPIC_CAMERA_CAPTURE);
        Serial.println("[MQTT] Subscribed to: " + String(TOPIC_CAMERA_CAPTURE));
        publishStatus("ONLINE", "Camera ready");
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

    if (topicStr == TOPIC_CAMERA_CAPTURE) {
        if (msgStr == "CAPTURE" || msgStr == "1" || msgStr == "ON") {
            Serial.println("[MQTT] Capture command received!");
            captureAndSendImage();
        }
    }
}

void publishStatus(String status, String message) {
    if (!mqttConnected) return;
    StaticJsonDocument<256> doc;
    doc["status"] = status;
    doc["message"] = message;
    doc["uptime"] = millis() / 1000;
    doc["camera_ready"] = cameraReady;
    doc["wifi"] = wifiConnected;
    doc["mqtt"] = mqttConnected;
    char jsonBuffer[256];
    serializeJson(doc, jsonBuffer);
    mqttClient.publish(TOPIC_CAMERA_STATUS, jsonBuffer);
}

void publishResponse(String message) {
    if (!mqttConnected) return;
    mqttClient.publish(TOPIC_CAMERA_RESPONSE, message.c_str());
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

void printStatus() {
    Serial.println("\n╔═══════════════════════════════════════╗");
    Serial.println("║ ESP32-CAM STATUS                    ║");
    Serial.println("╠═══════════════════════════════════════╣");
    Serial.printf("║ Camera      : %s                ║\n", cameraReady ? "READY ✅" : "ERROR ❌");
    Serial.printf("║ WiFi        : %s                ║\n", wifiConnected ? "Connected ✅" : "Offline ❌");
    Serial.printf("║ MQTT        : %s                ║\n", mqttConnected ? "Connected ✅" : "Disconnected ❌");
    Serial.printf("║ Uptime      : %lu s            ║\n", millis() / 1000);
    Serial.println("╠═══════════════════════════════════════╣");
    Serial.printf("║ Web Server  : http://%s    ║\n", WiFi.localIP().toString().c_str());
    Serial.printf("║ MQTT Broker : %s         ║\n", MQTT_BROKER);
    Serial.println("╚═══════════════════════════════════════╝\n");
}
