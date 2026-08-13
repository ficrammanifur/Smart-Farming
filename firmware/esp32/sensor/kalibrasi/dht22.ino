#include <DHT.h>

// ==========================================
// DHT22 TEST
// DATA -> GPIO 4
// ==========================================

#define DHT_PIN 4
#define DHT_TYPE DHT22

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {

  Serial.begin(115200);

  Serial.println("==============================");
  Serial.println("      DHT22 SENSOR TEST");
  Serial.println("==============================");

  dht.begin();

  delay(2000);
}

void loop() {

  // Baca humidity
  float humidity = dht.readHumidity();

  // Baca temperature Celsius
  float temperature = dht.readTemperature();

  // Cek apakah pembacaan valid
  if (isnan(humidity) || isnan(temperature)) {

    Serial.println("ERROR: Gagal membaca DHT22");

    delay(2000);
    return;
  }

  // ========================================
  // SERIAL MONITOR
  // ========================================

  Serial.print("Temperature : ");
  Serial.print(temperature, 1);
  Serial.println(" °C");

  Serial.print("Humidity    : ");
  Serial.print(humidity, 1);
  Serial.println(" %");

  Serial.println("------------------------------");

  delay(2000);
}
