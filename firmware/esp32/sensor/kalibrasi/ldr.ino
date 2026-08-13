// ==========================================
// LDR SENSOR TEST
// LDR AO -> GPIO 34
// ==========================================

#define LDR_PIN 34

void setup() {

  Serial.begin(115200);

  pinMode(LDR_PIN, INPUT);

  // ESP32 ADC 12-bit
  analogReadResolution(12);

  Serial.println("==============================");
  Serial.println("       LDR SENSOR TEST");
  Serial.println("==============================");
  Serial.println("GPIO : 34");
  Serial.println("==============================");

  delay(1000);
}

void loop() {

  int adcValue = analogRead(LDR_PIN);

  // Konversi ADC menjadi tegangan
  float voltage = (adcValue / 4095.0) * 3.3;

  Serial.print("ADC: ");
  Serial.print(adcValue);

  Serial.print(" | Voltage: ");
  Serial.print(voltage, 3);

  Serial.println(" V");

  delay(1000);
}
