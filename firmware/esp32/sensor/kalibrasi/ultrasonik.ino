// ==========================================
// ULTRASONIC WATER LEVEL
//
// Sensor : HC-SR04
// TRIG   : GPIO 18
// ECHO   : GPIO 19
//
// 17 cm = KOSONG
// 5 cm  = PENUH
//
// Semakin kecil jarak = air semakin tinggi
// ==========================================

#define TRIG_PIN 18
#define ECHO_PIN 19

#define EMPTY_DISTANCE 17.0
#define FULL_DISTANCE   5.0

#define MAX_DISTANCE 200.0

void setup() {

  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  digitalWrite(TRIG_PIN, LOW);

  Serial.println("==============================");
  Serial.println("   WATER LEVEL TEST");
  Serial.println("==============================");
  Serial.println("17 cm = KOSONG");
  Serial.println(" 5 cm = PENUH");
  Serial.println("==============================");

  delay(1000);
}

void loop() {

  // Trigger ultrasonic
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  // Baca echo
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {

    Serial.println("ERROR: Sensor tidak membaca");

    delay(500);
    return;
  }

  // Hitung jarak
  float distance = duration * 0.0343 / 2.0;

  // Batas maksimal sensor
  if (distance > MAX_DISTANCE) {

    Serial.print("Distance: ");
    Serial.print(distance, 1);
    Serial.println(" cm -> OUT OF RANGE");

    delay(500);
    return;
  }

  // ==========================================
  // HITUNG LEVEL AIR
  // ==========================================

  float waterLevel;

  if (distance >= EMPTY_DISTANCE) {

    // 17 cm atau lebih = kosong
    waterLevel = 0;

  }
  else if (distance <= FULL_DISTANCE) {

    // 5 cm atau kurang = penuh
    waterLevel = 100;

  }
  else {

    // 5 - 17 cm
    waterLevel =
      ((EMPTY_DISTANCE - distance) /
       (EMPTY_DISTANCE - FULL_DISTANCE)) * 100.0;
  }

  // Batasi 0-100%
  waterLevel = constrain(waterLevel, 0, 100);


  // ==========================================
  // STATUS AIR
  // ==========================================

  String status;

  if (waterLevel >= 80) {

    status = "AIR PENUH";

  }
  else if (waterLevel >= 40) {

    status = "AIR NORMAL";

  }
  else if (waterLevel > 0) {

    status = "AIR RENDAH";

  }
  else {

    status = "AIR KOSONG";
  }


  // ==========================================
  // SERIAL MONITOR
  // ==========================================

  Serial.print("Distance: ");
  Serial.print(distance, 2);

  Serial.print(" cm | Water Level: ");
  Serial.print(waterLevel, 1);

  Serial.print("% | ");

  Serial.println(status);

  delay(500);
}
