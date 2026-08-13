// ==========================================
// SOIL MOISTURE SENSOR TEST
// AO -> GPIO 35
// ==========================================

#define SOIL_PIN 35

// ==========================================
// KALIBRASI
//
// ADC tinggi  = KERING
// ADC rendah  = BASAH
//
// Berdasarkan hasil pengujian:
// Basah  : sekitar 1670 - 1776
// Normal : sekitar 2670 - 2800
// ==========================================

#define ADC_DRY 4095
#define ADC_WET 1700


void setup() {

  Serial.begin(115200);

  pinMode(SOIL_PIN, INPUT);

  // ESP32 ADC 12-bit
  analogReadResolution(12);

  Serial.println("==============================");
  Serial.println("   SOIL MOISTURE SENSOR TEST");
  Serial.println("==============================");
  Serial.println("GPIO : 35");
  Serial.println("DRY  : 4095 ADC");
  Serial.println("WET  : 1700 ADC");
  Serial.println("==============================");

  delay(1000);
}


void loop() {

  // ========================================
  // BACA ADC
  // ========================================

  int adcValue = analogRead(SOIL_PIN);


  // ========================================
  // KONVERSI ADC -> MOISTURE %
  //
  // 4095 = 0%
  // 1700 = 100%
  // ========================================

  int moisture = map(
    adcValue,
    ADC_DRY,
    ADC_WET,
    0,
    100
  );

  moisture = constrain(moisture, 0, 100);


  // ========================================
  // STATUS KELEMBAPAN
  //
  // < 55%  = KERING
  // 55-69% = NORMAL
  // >= 70% = BASAH
  // ========================================

  String status;

  if (moisture < 55) {

    status = "KERING";

  }
  else if (moisture < 70) {

    status = "NORMAL";

  }
  else {

    status = "BASAH";
  }


  // ========================================
  // SERIAL MONITOR
  // ========================================

  Serial.print("ADC: ");
  Serial.print(adcValue);

  Serial.print(" | Moisture: ");
  Serial.print(moisture);

  Serial.print("% | Status: ");

  Serial.println(status);


  delay(1000);
}
