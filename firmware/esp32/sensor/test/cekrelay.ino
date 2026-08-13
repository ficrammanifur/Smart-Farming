// ==========================================
// TEST RELAY ESP32
// Pump  : GPIO 26
// Lamp  : GPIO 27
// ==========================================

#define RELAY_PUMP 26
#define RELAY_LAMP 27

// Kebanyakan relay module = ACTIVE LOW
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_LAMP, OUTPUT);

  // Pastikan kedua relay mati saat boot
  digitalWrite(RELAY_PUMP, RELAY_OFF);
  digitalWrite(RELAY_LAMP, RELAY_OFF);

  Serial.println("================================");
  Serial.println("     RELAY TEST ESP32");
  Serial.println("================================");
}

void loop() {

  // ==============================
  // POMPA ON
  // ==============================
  Serial.println("POMPA -> ON");

  digitalWrite(RELAY_PUMP, RELAY_ON);
  digitalWrite(RELAY_LAMP, RELAY_OFF);

  delay(5000);

  // ==============================
  // POMPA OFF
  // ==============================
  Serial.println("POMPA -> OFF");

  digitalWrite(RELAY_PUMP, RELAY_OFF);

  delay(500);


  // ==============================
  // LAMPU ON
  // ==============================
  Serial.println("LAMPU -> ON");

  digitalWrite(RELAY_PUMP, RELAY_OFF);
  digitalWrite(RELAY_LAMP, RELAY_ON);

  delay(5000);

  // ==============================
  // LAMPU OFF
  // ==============================
  Serial.println("LAMPU -> OFF");

  digitalWrite(RELAY_LAMP, RELAY_OFF);

  delay(500);
}
