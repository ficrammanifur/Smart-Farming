#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

// ===========================
// WiFi
// ===========================
const char* ssid = "Dlink-WiFi5";
const char* password = "Qwerty13";

// ===========================
// AI Thinker ESP32-CAM PIN
// ===========================
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

WebServer server(80);

// ===========================
// Dashboard
// ===========================
const char MAIN_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>ESP32-CAM Dashboard</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f2f2f2;
      text-align: center;
      padding: 20px;
    }

    .card {
      max-width: 600px;
      margin: auto;
      background: white;
      padding: 20px;
      border-radius: 15px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.15);
    }

    h2 {
      margin-bottom: 20px;
    }

    #photo {
      width: 100%;
      max-width: 500px;
      border-radius: 10px;
      display: none;
      margin-top: 20px;
    }

    button {
      background: #007bff;
      color: white;
      border: none;
      padding: 14px 25px;
      font-size: 18px;
      border-radius: 8px;
      cursor: pointer;
    }

    button:active {
      background: #0056b3;
    }

    #status {
      margin-top: 15px;
      color: #555;
    }
  </style>
</head>

<body>

<div class="card">

  <h2>📷 ESP32-CAM Dashboard</h2>

  <button onclick="ambilGambar()">
    Ambil Gambar
  </button>

  <div id="status">
    Tekan tombol untuk mengambil gambar
  </div>

  <img id="photo">

</div>

<script>

function ambilGambar() {

  const status = document.getElementById("status");
  const photo = document.getElementById("photo");

  status.innerHTML = "📸 Mengambil gambar...";

  // Tambahkan timestamp agar browser tidak menggunakan cache
  photo.src = "/capture?t=" + new Date().getTime();

  photo.onload = function() {
    photo.style.display = "block";
    status.innerHTML = "✅ Gambar berhasil diambil";
  };

  photo.onerror = function() {
    status.innerHTML = "❌ Gagal mengambil gambar";
  };
}

</script>

</body>
</html>
)rawliteral";

// ===========================
// Halaman dashboard
// ===========================
void handleRoot() {
  server.send_P(200, "text/html", MAIN_PAGE);
}

// ===========================
// Ambil foto
// ===========================
void handleCapture() {

  camera_fb_t *fb = esp_camera_fb_get();

  if (!fb) {
    Serial.println("❌ Camera capture failed");

    server.send(
      500,
      "text/plain",
      "Camera capture failed"
    );

    return;
  }

  Serial.println("📸 Foto berhasil diambil");

  server.send_P(
    200,
    "image/jpeg",
    (const char*)fb->buf,
    fb->len
  );

  esp_camera_fb_return(fb);
}

// ===========================
// Setup
// ===========================
void setup() {

  Serial.begin(115200);

  Serial.println();
  Serial.println("==============================");
  Serial.println("ESP32-CAM SIMPLE DASHBOARD");
  Serial.println("==============================");

  // ===========================
  // Camera configuration
  // ===========================

  camera_config_t config;

  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;

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

  // Resolusi sederhana agar ringan
  config.frame_size = FRAMESIZE_VGA;

  config.jpeg_quality = 12;

  config.fb_count = 1;

  // ===========================
  // PSRAM
  // ===========================

  if (psramFound()) {

    Serial.println("✅ PSRAM ditemukan");

    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;

  } else {

    Serial.println("⚠️ PSRAM tidak ditemukan");

    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // ===========================
  // Camera init
  // ===========================

  esp_err_t err = esp_camera_init(&config);

  if (err != ESP_OK) {

    Serial.printf(
      "❌ Camera init failed: 0x%x\n",
      err
    );

    return;
  }

  Serial.println("✅ Kamera berhasil diinisialisasi");

  // ===========================
  // Sensor adjustment
  // ===========================

  sensor_t *s = esp_camera_sensor_get();

  s->set_framesize(s, FRAMESIZE_VGA);

  // ===========================
  // WiFi
  // ===========================

  WiFi.begin(ssid, password);

  Serial.print("Menghubungkan WiFi");

  while (WiFi.status() != WL_CONNECTED) {

    delay(500);
    Serial.print(".");
  }

  Serial.println();

  Serial.println("✅ WiFi terhubung");

  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // ===========================
  // Web server
  // ===========================

  server.on("/", HTTP_GET, handleRoot);

  server.on(
    "/capture",
    HTTP_GET,
    handleCapture
  );

  server.begin();

  Serial.println("✅ Web server aktif");

  Serial.println("==============================");
  Serial.print("Buka browser: http://");
  Serial.println(WiFi.localIP());
  Serial.println("==============================");
}

// ===========================
// Loop
// ===========================
void loop() {

  server.handleClient();

}
