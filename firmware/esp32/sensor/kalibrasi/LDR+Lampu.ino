// ==========================================
// LDR + RELAY LAMP TEST
//
// LDR    -> GPIO 34
// Relay  -> GPIO 27
// ==========================================

#define LDR_PIN 34
#define RELAY_LAMP 27

// Relay biasanya ACTIVE LOW
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// Threshold cahaya
#define LDR_THRESHOLD 2000


void setup() {

  Serial.begin(115200);

  pinMode(LDR_PIN, INPUT);
  pinMode(RELAY_LAMP, OUTPUT);

  analogReadResolution(12);

  // Lampu OFF saat startup
  digitalWrite(RELAY_LAMP, RELAY_OFF);

  Serial.println("==============================");
  Serial.println("     LDR AUTO LIGHT TEST");
  Serial.println("==============================");

}


void loop() {

  int adcValue = analogRead(LDR_PIN);

  float voltage =
    (adcValue / 4095.0) * 3.3;


  Serial.print("ADC: ");
  Serial.print(adcValue);

  Serial.print(" | Voltage: ");
  Serial.print(voltage, 3);

  Serial.print(" V | ");


  // ========================================
  // LOGIC LAMPU
  // ========================================

  if (adcValue >= LDR_THRESHOLD) {

    // GELAP
    digitalWrite(RELAY_LAMP, RELAY_ON);

    Serial.println("GELAP -> LAMPU ON");

  } else {

    // TERANG
    digitalWrite(RELAY_LAMP, RELAY_OFF);

    Serial.println("TERANG -> LAMPU OFF");
  }


  delay(1000);
}
