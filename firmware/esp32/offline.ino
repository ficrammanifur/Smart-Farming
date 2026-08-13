#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

// =====================================================
// PIN
// =====================================================

#define TRIG_PIN       18
#define ECHO_PIN       19

#define LDR_PIN        34
#define SOIL_PIN       35

#define DHT_PIN        4
#define DHT_TYPE       DHT22

#define RELAY_PUMP     26
#define RELAY_LAMP     27

#define BUZZER_PIN     23

#define LED_RED        25
#define LED_GREEN      33

#define LCD_SDA        21
#define LCD_SCL        22


// =====================================================
// RELAY
// Kebanyakan relay module = ACTIVE LOW
// =====================================================

#define RELAY_ON       LOW
#define RELAY_OFF      HIGH


// =====================================================
// SOIL MOISTURE
// =====================================================

#define ADC_DRY        4095
#define ADC_WET        1700


// =====================================================
// SOIL THRESHOLD
// =====================================================

#define SOIL_PUMP_ON   55
#define SOIL_PUMP_OFF  70


// =====================================================
// LDR
// =====================================================

#define LDR_ON         2200
#define LDR_OFF        1700


// =====================================================
// WATER LEVEL
// =====================================================

#define WATER_FULL_DISTANCE   5.0
#define WATER_EMPTY_DISTANCE  17.0

#define WATER_WARNING_LEVEL   20


// =====================================================
// OBJECT
// =====================================================

DHT dht(DHT_PIN, DHT_TYPE);

LiquidCrystal_I2C lcd(0x27, 16, 2);


// =====================================================
// STATUS
// =====================================================

bool pumpState = false;
bool lampState = false;
bool alarmState = false;


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  // -----------------------------
  // Pin Mode
  // -----------------------------

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(LDR_PIN, INPUT);
  pinMode(SOIL_PIN, INPUT);

  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_LAMP, OUTPUT);

  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);


  // -----------------------------
  // ADC
  // -----------------------------

  analogReadResolution(12);


  // -----------------------------
  // I2C
  // -----------------------------

  Wire.begin(LCD_SDA, LCD_SCL);


  // -----------------------------
  // LCD
  // -----------------------------

  lcd.init();
  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SMART FARMING");

  lcd.setCursor(0, 1);
  lcd.print("SYSTEM START");

  delay(2000);


  // -----------------------------
  // DHT
  // -----------------------------

  dht.begin();


  // -----------------------------
  // Output awal
  // -----------------------------

  digitalWrite(RELAY_PUMP, RELAY_OFF);
  digitalWrite(RELAY_LAMP, RELAY_OFF);

  digitalWrite(BUZZER_PIN, LOW);

  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, HIGH);


  Serial.println();
  Serial.println("================================");
  Serial.println("       SMART FARMING");
  Serial.println("       OFFLINE MODE");
  Serial.println("================================");
}


// =====================================================
// ULTRASONIC
// =====================================================

float readDistance() {

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    return -1;
  }

  float distance = duration * 0.0343 / 2.0;

  return distance;
}


// =====================================================
// WATER LEVEL
// =====================================================

float calculateWaterLevel(float distance) {

  if (distance < 0) {
    return -1;
  }

  // Air penuh
  if (distance <= WATER_FULL_DISTANCE) {
    return 100;
  }

  // Air kosong
  if (distance >= WATER_EMPTY_DISTANCE) {
    return 0;
  }

  // 5 - 17 cm
  float level =
    ((WATER_EMPTY_DISTANCE - distance) /
     (WATER_EMPTY_DISTANCE - WATER_FULL_DISTANCE)) * 100.0;

  return constrain(level, 0, 100);
}


// =====================================================
// LOOP
// =====================================================

void loop() {

  // ===================================================
  // SENSOR SOIL
  // ===================================================

  int soilADC = analogRead(SOIL_PIN);

  int moisture = map(
    soilADC,
    ADC_DRY,
    ADC_WET,
    0,
    100
  );

  moisture = constrain(moisture, 0, 100);


  // ===================================================
  // SOIL STATUS
  // ===================================================

  String soilStatus;

  if (moisture < 55) {

    soilStatus = "KERING";

  }
  else if (moisture < 70) {

    soilStatus = "NORMAL";

  }
  else {

    soilStatus = "BASAH";
  }


  // ===================================================
  // POMPA
  // ===================================================

  if (moisture < SOIL_PUMP_ON) {

    pumpState = true;

  }
  else if (moisture >= SOIL_PUMP_OFF) {

    pumpState = false;

  }

  digitalWrite(
    RELAY_PUMP,
    pumpState ? RELAY_ON : RELAY_OFF
  );


  // ===================================================
  // LDR
  // ===================================================

  int ldrADC = analogRead(LDR_PIN);


  if (ldrADC >= LDR_ON) {

    lampState = true;

  }
  else if (ldrADC <= LDR_OFF) {

    lampState = false;

  }

  digitalWrite(
    RELAY_LAMP,
    lampState ? RELAY_ON : RELAY_OFF
  );


  // ===================================================
  // DHT22
  // ===================================================

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();


  // ===================================================
  // ULTRASONIC
  // ===================================================

  float distance = readDistance();

  float waterLevel = calculateWaterLevel(distance);


  // ===================================================
  // WATER WARNING
  // ===================================================

  if (waterLevel >= 0 &&
      waterLevel <= WATER_WARNING_LEVEL) {

    alarmState = true;

  }
  else {

    alarmState = false;

  }


  // ===================================================
  // BUZZER
  // ===================================================

  digitalWrite(
    BUZZER_PIN,
    alarmState ? HIGH : LOW
  );


  // ===================================================
  // LED
  // ===================================================

  if (alarmState) {

    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);

  }
  else {

    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_GREEN, HIGH);

  }


  // ===================================================
  // SERIAL MONITOR
  // ===================================================

  Serial.println();
  Serial.println("--------------------------------");

  Serial.print("Temperature : ");

  if (isnan(temperature)) {
    Serial.println("ERROR");
  }
  else {
    Serial.print(temperature, 1);
    Serial.println(" C");
  }


  Serial.print("Humidity    : ");

  if (isnan(humidity)) {
    Serial.println("ERROR");
  }
  else {
    Serial.print(humidity, 1);
    Serial.println(" %");
  }


  Serial.print("Soil ADC    : ");
  Serial.println(soilADC);

  Serial.print("Soil Moist. : ");
  Serial.print(moisture);
  Serial.print("% | ");
  Serial.println(soilStatus);


  Serial.print("LDR ADC     : ");
  Serial.print(ldrADC);

  if (lampState) {
    Serial.println(" | DARK -> LAMP ON");
  }
  else {
    Serial.println(" | LIGHT -> LAMP OFF");
  }


  Serial.print("Water Dist. : ");

  if (distance < 0) {

    Serial.println("ERROR");

  }
  else {

    Serial.print(distance, 1);
    Serial.println(" cm");
  }


  Serial.print("Water Level : ");

  if (waterLevel < 0) {

    Serial.println("ERROR");

  }
  else {

    Serial.print(waterLevel, 1);
    Serial.println(" %");
  }


  Serial.print("Pump        : ");
  Serial.println(pumpState ? "ON" : "OFF");

  Serial.print("Lamp        : ");
  Serial.println(lampState ? "ON" : "OFF");

  Serial.print("Alarm       : ");
  Serial.println(alarmState ? "WARNING" : "NORMAL");


  // ===================================================
  // LCD
  // ===================================================

  lcd.clear();

  lcd.setCursor(0, 0);

  if (!isnan(temperature)) {
    lcd.print("T:");
    lcd.print(temperature, 1);
    lcd.print("C ");
  }

  if (!isnan(humidity)) {
    lcd.print("H:");
    lcd.print(humidity, 0);
    lcd.print("%");
  }


  lcd.setCursor(0, 1);

  if (waterLevel >= 0) {

    lcd.print("W:");
    lcd.print(waterLevel, 0);
    lcd.print("% ");

  }

  lcd.print("P:");
  lcd.print(pumpState ? "ON" : "OFF");


  // ===================================================
  // LOOP INTERVAL
  // ===================================================

  delay(2000);
}
