/*
 * ============================================================
 * ESP32-CAM - SMART FARMING CAMERA MODULE
 * WITH MQTT + WiFiManager
 * ============================================================
 * 
 * FITUR:
 * - Web Server untuk akses gambar via browser
 * - MQTT untuk trigger capture dari dashboard
 * - WiFiManager untuk setting WiFi mudah
 * - Kirim gambar via MQTT ke dashboard
 * 
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

#define CAMERA_MODEL_AI_THINKER // ESP32-CAM AI-Thinker
#include "camera_pins.h"

// ============================================================
// MQTT CONFIG
// ============================================================

#define MQTT_BROKER "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_CLIENT_ID "esp32-cam-001"

// Topics
#define TOPIC_CAMERA_CAPTURE   "smartfarm/camera/capture"
#define TOPIC_CAMERA_IMAGE     "smartfarm/camera/image"
#define TOPIC_CAMERA_RESPONSE  "smartfarm/camera/response"
#define TOPIC_CAMERA_STATUS    "smartfarm/camera/status"

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
unsigned long autoCaptureInterval = 60000; // 1 menit

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
    // SETUP WIFI (WiFiManager)
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

    // ==========================================================
    // STARTUP COMPLETE
    // ==========================================================

    Serial.println("\n[OK] SYSTEM READY!");
    Serial.println("================================================\n");
    Serial.println("COMMANDS (via Serial):");
    Serial.println("  capture - Take a photo");
    Serial.println("  status  - Show system status");
    Serial.println("  reset   - Reset system");
    Serial.println("================================================\n");
    Serial.println("MQTT Topics:");
    Serial.println("  Subscribe: " + String(TOPIC_CAMERA_CAPTURE));
    Serial.println("  Publish:   " + String(TOPIC_CAMERA_IMAGE));
    Serial.println("  Publish:   " + String(TOPIC_CAMERA_RESPONSE));
    Serial.println("  Publish:   " + String(TOPIC_CAMERA_STATUS));
    Serial.println("================================================\n");
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
    // AUTO CAPTURE (every interval)
    // ==========================================================

    if (cameraReady && mqttConnected && !captureInProgress) {
        if (now - lastAutoCapture >= autoCaptureInterval) {
            lastAutoCapture = now;
            Serial.println("[AUTO] Capturing...");
            captureAndSendImage();
        }
    }

    // ==========================================================
    // SERIAL COMMANDS
    // ==========================================================

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
    config.frame_size = FRAMESIZE_UXGA;
    config.pixel_format = PIXFORMAT_JPEG;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.jpeg_quality = 12;
    config.fb_count = 1;

    // If PSRAM available, use higher quality
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

    // Sensor settings
    sensor_t *s = esp_camera_sensor_get();
    if (s->id.PID == OV3660_PID) {
        s->set_vflip(s, 1);
        s->set_brightness(s, 1);
        s->set_saturation(s, -2);
    }
    
    // Drop down frame size for higher initial frame rate
    if (config.pixel_format == PIXFORMAT_JPEG) {
        s->set_framesize(s, FRAMESIZE_QVGA);
    }

#if defined(CAMERA_MODEL_M5STACK_WIDE) || defined(CAMERA_MODEL_M5STACK_ESP32CAM)
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);
#endif

#if defined(CAMERA_MODEL_ESP32S3_EYE)
    s->set_vflip(s, 1);
#endif

#if defined(LED_GPIO_NUM)
    setupLedFlash(LED_GPIO_NUM);
#endif

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
    // CAPTURE
    // ==========================================================

    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("[CAMERA] Failed to capture!");
        captureInProgress = false;
        publishStatus("ERROR", "Failed to capture image");
        publishResponse("ERROR");
        return;
    }

    Serial.printf("[CAMERA] Captured! Size: %zu bytes\n", fb->len);

    // ==========================================================
    // FLASH LED (effect)
    // ==========================================================

    #if defined(LED_GPIO_NUM)
    digitalWrite(LED_GPIO_NUM, HIGH);
    delay(50);
    digitalWrite(LED_GPIO_NUM, LOW);
    #endif

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

    // MQTT message size limit ~ 256KB
    // Base64 image usually 100-200KB
    // Send directly if size < 200KB
    
    if (base64Image.length() < 200000) {
        mqttClient.publish(TOPIC_CAMERA_IMAGE, base64Image.c_str());
        Serial.printf("[MQTT] Image sent: %d chars\n", base64Image.length());
    } else {
        // Split into chunks if too large
        Serial.println("[MQTT] Image too large, splitting...");
        splitAndSendImage(base64Image);
    }
}

void splitAndSendImage(String base64Image) {
    const int CHUNK_SIZE = 180000; // 180KB per chunk
    int totalChunks = (base64Image.length() + CHUNK_SIZE - 1) / CHUNK_SIZE;
    
    for (int i = 0; i < totalChunks; i++) {
        int start = i * CHUNK_SIZE;
        int end = min(start + CHUNK_SIZE, (int)base64Image.length());
        String chunk = base64Image.substring(start, end);
        
        // Send chunk with header: "1/3:base64data..."
        String payload = String(i + 1) + "/" + String(totalChunks) + ":" + chunk;
        mqttClient.publish(TOPIC_CAMERA_IMAGE, payload.c_str());
        
        Serial.printf("[MQTT] Chunk %d/%d sent\n", i + 1, totalChunks);
        delay(100); // Delay antar chunk
    }
}

// ============================================================
// WIFI FUNCTIONS (WiFiManager)
// ============================================================

void setupWiFi() {
    Serial.println("[WIFI] Starting WiFiManager...");
    Serial.println("[WIFI] Jika gagal, buka hotspot 'SmartFarm-CAM'");
    Serial.println("[WIFI] Password: 12345678");

    // Reset settings - uncomment if needed
    // wifiManager.resetSettings();

    wifiManager.setConfigPortalTimeout(60);
    wifiManager.setConnectTimeout(30);
    wifiManager.setDebugOutput(true);

    bool connected = wifiManager.autoConnect("SmartFarm-CAM", "12345678");

    if (connected) {
        wifiConnected = true;
        Serial.println("[WIFI] ✅ Connected!");
        Serial.printf("[WIFI] SSID: %s\n", WiFi.SSID().c_str());
        Serial.printf("[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("[WIFI] RSSI: %d dBm\n", WiFi.RSSI());
    } else {
        wifiConnected = false;
        Serial.println("[WIFI] ❌ Timeout - OFFLINE mode");
        Serial.println("[WIFI] Restart ESP32 untuk mencoba lagi");
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

    Serial.print("[MQTT] Connecting to ");
    Serial.print(MQTT_BROKER);
    Serial.print("...");
    
    bool ok = mqttClient.connect(MQTT_CLIENT_ID);

    if (ok) {
        mqttConnected = true;
        Serial.println(" ✅ Connected!");

        // Subscribe ke topic capture
        mqttClient.subscribe(TOPIC_CAMERA_CAPTURE);
        Serial.println("[MQTT] Subscribed to: " + String(TOPIC_CAMERA_CAPTURE));

        // Publish status
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

    // ==========================================================
    // CAPTURE COMMAND
    // ==========================================================

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
    doc["free_heap"] = ESP.getFreeHeap();
    doc["free_psram"] = ESP.getFreePsram();

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
    #if defined(LED_GPIO_NUM)
    for (int i = 0; i < times; i++) {
        digitalWrite(LED_GPIO_NUM, LOW);
        delay(duration);
        digitalWrite(LED_GPIO_NUM, HIGH);
        delay(duration);
    }
    #endif
}

void printStatus() {
    Serial.println("\n╔═══════════════════════════════════════╗");
    Serial.println("║ ESP32-CAM STATUS                    ║");
    Serial.println("╠═══════════════════════════════════════╣");
    Serial.printf("║ Camera      : %s                ║\n", cameraReady ? "READY ✅" : "ERROR ❌");
    Serial.printf("║ WiFi        : %s                ║\n", wifiConnected ? "Connected ✅" : "Offline ❌");
    Serial.printf("║ MQTT        : %s                ║\n", mqttConnected ? "Connected ✅" : "Disconnected ❌");
    Serial.printf("║ Free Heap   : %6d bytes         ║\n", ESP.getFreeHeap());
    Serial.printf("║ Free PSRAM  : %6d bytes         ║\n", ESP.getFreePsram());
    Serial.printf("║ Uptime      : %lu s            ║\n", millis() / 1000);
    Serial.println("╠═══════════════════════════════════════╣");
    Serial.printf("║ Web Server  : http://%s    ║\n", WiFi.localIP().toString().c_str());
    Serial.printf("║ MQTT Broker : %s         ║\n", MQTT_BROKER);
    Serial.println("╚═══════════════════════════════════════╝\n");
}

// ============================================================
// WEBSERVER FUNCTIONS (dari library default)
// ============================================================

// Fungsi startCameraServer() dan setupLedFlash() 
// sudah ada di library ESP32 (app_httpd.cpp)
// Tidak perlu diimplementasikan ulang
