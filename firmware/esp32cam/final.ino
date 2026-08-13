/*
 * ============================================================
 * ESP32-CAM - SMART FARMING CAMERA MODULE
 * DENGAN FLASH DAN BRIGHTNESS FIX
 * ============================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <base64.h>

// ============================================================
// SELECT CAMERA MODEL
// ============================================================

#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

// ============================================================
// MQTT CONFIG
// ============================================================

#define MQTT_BROKER "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_CLIENT_ID "esp32-cam-001"

#define TOPIC_CAMERA_CAPTURE   "smartfarm/camera/capture"
#define TOPIC_CAMERA_IMAGE     "smartfarm/camera/image"
#define TOPIC_CAMERA_RESPONSE  "smartfarm/camera/response"
#define TOPIC_CAMERA_STATUS    "smartfarm/camera/status"

// ============================================================
// PIN DEFINISI
// ============================================================

#define FLASH_LED_PIN     4   // GPIO 4 untuk flash LED

// ============================================================
// OBJECTS
// ============================================================

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

unsigned long lastAutoCapture = 0;
unsigned long autoCaptureInterval = 60000;

// ============================================================
// FUNCTION PROTOTYPES
// ============================================================

void initCamera();
void startCameraServer();
void setupLedFlash(int pin);

void setupWiFi();
void setupMQTT();
void mqttReconnect();
void mqttCallback(char* topic, byte* payload, unsigned int length);

void captureAndSendImage();
void sendImageViaMQTT(String base64Image);
void splitAndSendImage(String base64Image);
void publishStatus(String status, String message);
void publishResponse(String message);

void blinkLED(int times, int duration);
void printStatus();

// ============================================================
// SETUP
// ============================================================

void setup() {
    Serial.begin(115200);
    Serial.setDebugOutput(true);
    delay(3000);

    Serial.println("\n================================================");
    Serial.println("       ESP32-CAM SMART FARMING");
    Serial.println("    CAMERA + MQTT + WiFiManager");
    Serial.println("================================================\n");

    // ==========================================================
    // PIN MODE
    // ==========================================================

    pinMode(FLASH_LED_PIN, OUTPUT);
    digitalWrite(FLASH_LED_PIN, LOW);

    // ==========================================================
    // INIT CAMERA
    // ==========================================================

    Serial.println("[CAMERA] Initializing...");
    initCamera();
    
    if (cameraReady) {
        Serial.println("[CAMERA] ✅ Ready!");
        blinkLED(2, 200);
    } else {
        Serial.println("[CAMERA] ❌ Failed to initialize!");
    }

    // ==========================================================
    // SETUP WIFI
    // ==========================================================

    setupWiFi();

    // ==========================================================
    // START WEB SERVER
    // ==========================================================

    if (wifiConnected) {
        startCameraServer();
        Serial.print("[SERVER] Camera Ready! Use 'http://");
        Serial.print(WiFi.localIP());
        Serial.println("' to connect");
    }

    // ==========================================================
    // SETUP MQTT
    // ==========================================================

    if (wifiConnected) {
        setupMQTT();
        mqttReconnect();
    }

    // ==========================================================
    // PUBLISH INITIAL STATUS
    // ==========================================================

    if (mqttConnected) {
        publishStatus("ONLINE", "Camera ready");
        publishResponse("SYSTEM_READY");
    }

    Serial.println("\n[OK] SYSTEM READY!");
    Serial.println("================================================\n");
    Serial.println("COMMANDS (via Serial):");
    Serial.println("  capture - Take a photo");
    Serial.println("  status  - Show system status");
    Serial.println("  reset   - Reset system");
    Serial.println("================================================\n");
}

// ============================================================
// MAIN LOOP
// ============================================================

void loop() {
    unsigned long now = millis();

    if (mqttConnected) {
        mqttClient.loop();
    } else if (wifiConnected) {
        static unsigned long lastMQTTRetry = 0;
        if (now - lastMQTTRetry > 10000) {
            lastMQTTRetry = now;
            mqttReconnect();
        }
    }

    if (cameraReady && mqttConnected && !captureInProgress) {
        if (now - lastAutoCapture >= autoCaptureInterval) {
            lastAutoCapture = now;
            Serial.println("[AUTO] Capturing...");
            captureAndSendImage();
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
            Serial.println("  capture - Take a photo");
            Serial.println("  status  - Show system status");
            Serial.println("  reset   - Reset system");
            Serial.println("  help    - Show this help");
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
    config.frame_size = FRAMESIZE_QVGA;  // 320x240 - lebih kecil = lebih terang
    config.pixel_format = PIXFORMAT_JPEG;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.jpeg_quality = 15;  // 10-63 (rendah = kualitas tinggi)
    config.fb_count = 1;

    if (config.pixel_format == PIXFORMAT_JPEG) {
        if (psramFound()) {
            config.jpeg_quality = 10;
            config.fb_count = 2;
            config.grab_mode = CAMERA_GRAB_LATEST;
        } else {
            config.frame_size = FRAMESIZE_SVGA;
            config.fb_location = CAMERA_FB_IN_DRAM;
        }
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAMERA] Init failed! Error: 0x%x\n", err);
        cameraReady = false;
        return;
    }

    // ==========================================================
    // SETTINGS SENSOR - BRIGHTNESS FIX
    // ==========================================================

    sensor_t *s = esp_camera_sensor_get();
    
    // Set sensor settings untuk gambar lebih terang
    s->set_brightness(s, 2);        // 0 = normal, 1-2 = lebih terang
    s->set_contrast(s, 1);          // Tingkatkan kontras
    s->set_saturation(s, 1);        // Tingkatkan saturasi
    s->set_gainceiling(s, GAINCEILING_8X); // Gain tinggi
    s->set_agc_gain(s, 30);         // Auto gain control (0-30)
    s->set_aec2(s, 1);              // Auto exposure control
    s->set_aec_value(s, 500);       // Exposure value (0-1200)
    s->set_wb_mode(s, 0);           // White balance auto
    
    // Flip jika diperlukan
    if (s->id.PID == OV3660_PID) {
        s->set_vflip(s, 1);
        s->set_brightness(s, 2);
        s->set_saturation(s, -2);
    }

#if defined(CAMERA_MODEL_M5STACK_WIDE) || defined(CAMERA_MODEL_M5STACK_ESP32CAM)
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);
#endif

    Serial.println("[CAMERA] Settings applied - Brightness increased");

    cameraReady = true;
}

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
    blinkLED(1, 100);
    publishResponse("CAPTURING");

    // ==========================================================
    // NYALAKAN FLASH LED
    // ==========================================================

    Serial.println("[CAMERA] Flash ON");
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(300);  // Tunggu 300ms agar flash stabil

    // ==========================================================
    // CAPTURE
    // ==========================================================

    camera_fb_t *fb = esp_camera_fb_get();
    
    // Matikan flash setelah capture
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

    // ==========================================================
    // CONVERT TO BASE64
    // ==========================================================

    String base64Image = base64::encode(fb->buf, fb->len);
    
    esp_camera_fb_return(fb);

    if (base64Image.length() == 0) {
        Serial.println("[CAMERA] Failed to encode!");
        captureInProgress = false;
        publishStatus("ERROR", "Failed to encode image");
        publishResponse("ENCODE_ERROR");
        return;
    }

    Serial.printf("[CAMERA] Base64 size: %zu chars\n", base64Image.length());

    // ==========================================================
    // SEND VIA MQTT
    // ==========================================================

    if (mqttConnected) {
        sendImageViaMQTT(base64Image);
        publishStatus("OK", "Image sent");
        publishResponse("DONE");
        Serial.println("[CAMERA] Image sent via MQTT");
    } else {
        Serial.println("[CAMERA] MQTT not connected!");
        publishResponse("MQTT_ERROR");
    }

    captureInProgress = false;
    blinkLED(2, 100);
}

void sendImageViaMQTT(String base64Image) {
    if (!mqttConnected) return;
    
    if (base64Image.length() < 200000) {
        mqttClient.publish(TOPIC_CAMERA_IMAGE, base64Image.c_str());
        Serial.printf("[MQTT] Image sent: %d chars\n", base64Image.length());
    } else {
        Serial.println("[MQTT] Image too large, splitting...");
        splitAndSendImage(base64Image);
    }
}

void splitAndSendImage(String base64Image) {
    const int CHUNK_SIZE = 180000;
    int totalChunks = (base64Image.length() + CHUNK_SIZE - 1) / CHUNK_SIZE;
    
    for (int i = 0; i < totalChunks; i++) {
        int start = i * CHUNK_SIZE;
        int end = min(start + CHUNK_SIZE, (int)base64Image.length());
        String chunk = base64Image.substring(start, end);
        
        String payload = String(i + 1) + "/" + String(totalChunks) + ":" + chunk;
        mqttClient.publish(TOPIC_CAMERA_IMAGE, payload.c_str());
        
        Serial.printf("[MQTT] Chunk %d/%d sent\n", i + 1, totalChunks);
        delay(100);
    }
}

// ============================================================
// WIFI FUNCTIONS
// ============================================================

void setupWiFi() {
    Serial.println("[WIFI] Starting WiFiManager...");
    Serial.println("[WIFI] Jika gagal, buka hotspot 'SmartFarm-CAM'");

    wifiManager.setConfigPortalTimeout(60);
    wifiManager.setConnectTimeout(30);
    wifiManager.setDebugOutput(true);

    bool connected = wifiManager.autoConnect("SmartFarm-CAM", "12345678");

    if (connected) {
        wifiConnected = true;
        Serial.println("[WIFI] ✅ Connected!");
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

void blinkLED(int times, int duration) {
    for (int i = 0; i < times; i++) {
        digitalWrite(FLASH_LED_PIN, HIGH);
        delay(duration);
        digitalWrite(FLASH_LED_PIN, LOW);
        delay(duration);
    }
}

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
    Serial.println("╚═══════════════════════════════════════╝\n");
}

// ============================================================
// WEBSERVER FUNCTIONS (dari library)
// ============================================================

// startCameraServer() dan setupLedFlash() dari library ESP32
