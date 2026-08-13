// ==========================================
// TEST LED ESP32
// LED MERAH  : GPIO 25
// LED HIJAU  : GPIO 33
// ==========================================

#define LED_RED   25
#define LED_GREEN 33

void setup() {
  Serial.begin(115200);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);

  // Pastikan kedua LED mati saat boot
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, LOW);

  Serial.println("================================");
  Serial.println("       LED TEST ESP32");
  Serial.println("================================");
}

void loop() {

  // ==============================
  // LED MERAH ON
  // ==============================
  Serial.println("LED MERAH -> ON");

  digitalWrite(LED_RED, HIGH);
  digitalWrite(LED_GREEN, LOW);

  delay(5000);

  // ==============================
  // LED MERAH OFF
  // ==============================
  Serial.println("LED MERAH -> OFF");

  digitalWrite(LED_RED, LOW);

  delay(500);


  // ==============================
  // LED HIJAU ON
  // ==============================
  Serial.println("LED HIJAU -> ON");

  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, HIGH);

  delay(5000);

  // ==============================
  // LED HIJAU OFF
  // ==============================
  Serial.println("LED HIJAU -> OFF");

  digitalWrite(LED_GREEN, LOW);

  delay(500);
}
