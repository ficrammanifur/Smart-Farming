// ============================================================
// SMART FARMING - ESP32
// OFFLINE AUTOMATION MODE
// ============================================================
//
// SENSOR
// ------------------------------------------------------------
// Ultrasonic  : TRIG GPIO 18 | ECHO GPIO 19
// LDR         : GPIO 34
// Soil        : GPIO 35
// DHT22       : GPIO 4
//
// OUTPUT
// ------------------------------------------------------------
// Relay Pump  : GPIO 26
// Relay Lamp  : GPIO 27
// Buzzer      : GPIO 23
// LED Red     : GPIO 25
// LED Green   : GPIO 33
//
// LCD I2C
// ------------------------------------------------------------
// SDA         : GPIO 21
// SCL         : GPIO 22
//
// ============================================================

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>


// ============================================================
// PIN CONFIGURATION
// ============================================================

#define TRIG_PIN        18
#define ECHO_PIN        19

#define LDR_PIN         34
#define SOIL_PIN        35

#define DHT_PIN         4
#define DHT_TYPE        DHT22

#define RELAY_PUMP      26
#define RELAY_LAMP      27

#define BUZZER_PIN      23

#define LED_RED         25
#define LED_GREEN       33

#define LCD_SDA         21
#define LCD_SCL         22


// ============================================================
// RELAY LOGIC
// Kebanyakan relay module menggunakan ACTIVE LOW
// ============================================================

#define RELAY_ON        LOW
#define RELAY_OFF       HIGH


// ============================================================
// SOIL MOISTURE CALIBRATION
//
// ADC tinggi = kering
// ADC rendah = basah
//
// Berdasarkan hasil pengujian:
// Basah  : sekitar 1670 - 1776
// Normal : sekitar 2670 - 2800
// ============================================================

#define ADC_DRY         4095
#define ADC_WET         1700


// ============================================================
// SOIL MOISTURE THRESHOLD
//
// < 55%       = KERING
// 55 - 69%    = NORMAL
// >= 70%      = BASAH
//
// Pompa:
// < 55%       = ON
// >= 70%      = OFF
// 55 - 69%    = pertahankan status
// ============================================================

#define SOIL_PUMP_ON    55
#define SOIL_PUMP_OFF   70


// ============================================================
// LDR THRESHOLD
//
// Berdasarkan hasil pengujian:
//
// Terang = sekitar 0 ADC
// Normal = sekitar 1400 ADC
// Gelap  = sekitar 3000+ ADC
//
// Hysteresis:
//
// >= 2200 = Lampu ON
// <= 1700 = Lampu OFF
// ============================================================

#define LDR_ON          2200
#define LDR_OFF         1700


// ============================================================
// WATER TANK
//
// Sensor berada di bagian atas tandon.
//
// <= 5 cm  = PENUH
// 17 cm    = KOSONG
// >= 17 cm = KOSONG
//
// 5 - 17 cm = dihitung menjadi 0 - 100%
// ============================================================

#define WATER_FULL_DISTANCE     5.0
#define WATER_EMPTY_DISTANCE    17.0


// ============================================================
// WATER SAFETY
//
// <= 20% = AIR KRITIS
//
// Jika air <= 20%:
// - Pompa OFF paksa
// - Buzzer ON
// - LED Merah ON
// - LED Hijau OFF
// ============================================================

#define WATER_WARNING_LEVEL     20.0


// ============================================================
// OBJECT
// ============================================================

DHT dht(DHT_PIN, DHT_TYPE);

LiquidCrystal_I2C lcd(0x27, 16, 2);


// ============================================================
// SYSTEM STATE
// ============================================================

bool pumpState = false;
bool lampState = false;
bool alarmState = false;


// ============================================================
// ULTRASONIC FUNCTION
// ============================================================

float readDistance() {

  // Pastikan trigger LOW
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  // Trigger pulse 10 us
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Baca echo
  long duration = pulseIn(
    ECHO_PIN,
    HIGH,
    30000
  );

  // Tidak ada pantulan
  if (duration == 0) {
    return -1;
  }

  // Kecepatan suara = 0.0343 cm/us
  float distance =
    duration * 0.0343 / 2.0;

  return distance;
}


// ============================================================
// WATER LEVEL CALCULATION
// ============================================================

float calculateWaterLevel(float distance) {

  // Sensor error
  if (distance < 0) {
    return -1;
  }

  // ==========================================
  // AIR PENUH
  // ==========================================

  if (distance <= WATER_FULL_DISTANCE) {
    return 100.0;
  }


  // ==========================================
  // AIR KOSONG
  // ==========================================

  if (distance >= WATER_EMPTY_DISTANCE) {
    return 0.0;
  }


  // ==========================================
  // 5 - 17 CM
  // ==========================================

  float level =
    (
      (WATER_EMPTY_DISTANCE - distance)
      /
      (WATER_EMPTY_DISTANCE - WATER_FULL_DISTANCE)
    ) * 100.0;


  return constrain(
    level,
    0.0,
    100.0
  );
}


// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  // ==========================================================
  // PIN MODE
  // ==========================================================

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(LDR_PIN, INPUT);
  pinMode(SOIL_PIN, INPUT);

  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_LAMP, OUTPUT);

  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);


  // ==========================================================
  // ADC
  // ==========================================================

  analogReadResolution(12);


  // ==========================================================
  // I2C
  // ==========================================================

  Wire.begin(
    LCD_SDA,
    LCD_SCL
  );


  // ==========================================================
  // LCD
  // ==========================================================

  lcd.init();
  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SMART FARMING");

  lcd.setCursor(0, 1);
  lcd.print("SYSTEM START");

  delay(2000);


  // ==========================================================
  // DHT22
  // ==========================================================

  dht.begin();


  // ==========================================================
  // INITIAL OUTPUT
  // ==========================================================

  pumpState = false;
  lampState = false;
  alarmState = false;

  digitalWrite(
    RELAY_PUMP,
    RELAY_OFF
  );

  digitalWrite(
    RELAY_LAMP,
    RELAY_OFF
  );

  digitalWrite(
    BUZZER_PIN,
    LOW
  );

  digitalWrite(
    LED_RED,
    LOW
  );

  digitalWrite(
    LED_GREEN,
    HIGH
  );


  // ==========================================================
  // SERIAL
  // ==========================================================

  Serial.println();
  Serial.println("================================================");
  Serial.println("          SMART FARMING SYSTEM");
  Serial.println("              OFFLINE MODE");
  Serial.println("================================================");

  Serial.println();
  Serial.println("PIN CONFIGURATION");
  Serial.println("-----------------");

  Serial.println("Ultrasonic : TRIG 18 | ECHO 19");
  Serial.println("LDR        : GPIO 34");
  Serial.println("Soil       : GPIO 35");
  Serial.println("DHT22      : GPIO 4");
  Serial.println("Pump Relay : GPIO 26");
  Serial.println("Lamp Relay : GPIO 27");
  Serial.println("Buzzer     : GPIO 23");
  Serial.println("LED Red    : GPIO 25");
  Serial.println("LED Green  : GPIO 33");
  Serial.println("LCD        : SDA 21 | SCL 22");

  Serial.println();
  Serial.println("SYSTEM READY");
  Serial.println("================================================");
}


// ============================================================
// LOOP
// ============================================================

void loop() {

  // ==========================================================
  // 1. READ SOIL MOISTURE
  // ==========================================================

  int soilADC = analogRead(
    SOIL_PIN
  );


  int moisture = map(
    soilADC,
    ADC_DRY,
    ADC_WET,
    0,
    100
  );


  moisture = constrain(
    moisture,
    0,
    100
  );


  // ==========================================================
  // SOIL STATUS
  // ==========================================================

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


  // ==========================================================
  // 2. READ ULTRASONIC
  // ==========================================================

  float distance = readDistance();


  float waterLevel =
    calculateWaterLevel(
      distance
    );


  // ==========================================================
  // 3. WATER SAFETY ALARM
  // ==========================================================

  if (
    waterLevel >= 0 &&
    waterLevel <= WATER_WARNING_LEVEL
  ) {

    alarmState = true;

  }
  else {

    alarmState = false;
  }


  // ==========================================================
  // 4. PUMP CONTROL
  //
  // PRIORITY:
  //
  // WATER SAFETY > SOIL MOISTURE
  //
  // Jika air kritis:
  // POMPA WAJIB OFF
  // ==========================================================

  if (
    waterLevel >= 0 &&
    waterLevel <= WATER_WARNING_LEVEL
  ) {

    // ==========================================
    // AIR TANDON KRITIS
    // ==========================================

    pumpState = false;

  }
  else if (waterLevel < 0) {

    // ==========================================
    // SENSOR ULTRASONIC ERROR
    //
    // Demi keamanan:
    // Jangan menyalakan pompa
    // ==========================================

    pumpState = false;

  }
  else {

    // ==========================================
    // AIR CUKUP
    //
    // BARU CEK SOIL
    // ==========================================

    if (moisture < SOIL_PUMP_ON) {

      pumpState = true;

    }
    else if (moisture >= SOIL_PUMP_OFF) {

      pumpState = false;

    }

    // 55 - 69%
    // Pertahankan status sebelumnya
  }


  // ==========================================================
  // APPLY PUMP RELAY
  // ==========================================================

  digitalWrite(
    RELAY_PUMP,
    pumpState
      ? RELAY_ON
      : RELAY_OFF
  );


  // ==========================================================
  // 5. READ LDR
  // ==========================================================

  int ldrADC = analogRead(
    LDR_PIN
  );


  // ==========================================================
  // LAMP CONTROL
  //
  // >= 2200 → GELAP → ON
  // <= 1700 → TERANG → OFF
  //
  // 1700 - 2199
  // pertahankan status
  // ==========================================================

  if (ldrADC >= LDR_ON) {

    lampState = true;

  }
  else if (ldrADC <= LDR_OFF) {

    lampState = false;

  }


  // ==========================================================
  // APPLY LAMP RELAY
  // ==========================================================

  digitalWrite(
    RELAY_LAMP,
    lampState
      ? RELAY_ON
      : RELAY_OFF
  );


  // ==========================================================
  // 6. READ DHT22
  // ==========================================================

  float temperature =
    dht.readTemperature();

  float humidity =
    dht.readHumidity();


  // ==========================================================
  // 7. BUZZER
  // ==========================================================

  digitalWrite(
    BUZZER_PIN,
    alarmState
      ? HIGH
      : LOW
  );


  // ==========================================================
  // 8. LED STATUS
  // ==========================================================

  if (alarmState) {

    digitalWrite(
      LED_RED,
      HIGH
    );

    digitalWrite(
      LED_GREEN,
      LOW
    );

  }
  else {

    digitalWrite(
      LED_RED,
      LOW
    );

    digitalWrite(
      LED_GREEN,
      HIGH
    );
  }


  // ==========================================================
  // 9. SERIAL MONITOR
  // ==========================================================

  Serial.println();
  Serial.println("================================================");
  Serial.println("                SENSOR STATUS");
  Serial.println("================================================");


  // -------------------------
  // DHT22
  // -------------------------

  Serial.print("Temperature : ");

  if (isnan(temperature)) {

    Serial.println("ERROR");

  }
  else {

    Serial.print(
      temperature,
      1
    );

    Serial.println(" C");
  }


  Serial.print("Humidity    : ");

  if (isnan(humidity)) {

    Serial.println("ERROR");

  }
  else {

    Serial.print(
      humidity,
      1
    );

    Serial.println(" %");
  }


  // -------------------------
  // SOIL
  // -------------------------

  Serial.print("Soil ADC    : ");
  Serial.println(soilADC);


  Serial.print("Soil        : ");
  Serial.print(moisture);
  Serial.print("% | ");
  Serial.println(soilStatus);


  // -------------------------
  // LDR
  // -------------------------

  Serial.print("LDR ADC     : ");
  Serial.println(ldrADC);


  Serial.print("Lamp        : ");

  if (lampState) {

    Serial.println("ON - GELAP");

  }
  else {

    Serial.println("OFF - TERANG");
  }


  // -------------------------
  // WATER
  // -------------------------

  Serial.print("Water Dist. : ");

  if (distance < 0) {

    Serial.println("ERROR");

  }
  else {

    Serial.print(
      distance,
      2
    );

    Serial.println(" cm");
  }


  Serial.print("Water Level : ");

  if (waterLevel < 0) {

    Serial.println("ERROR");

  }
  else {

    Serial.print(
      waterLevel,
      1
    );

    Serial.println(" %");
  }


  // -------------------------
  // PUMP
  // -------------------------

  Serial.print("Pump        : ");

  if (pumpState) {

    Serial.println("ON");

  }
  else {

    Serial.println("OFF");
  }


  // -------------------------
  // ALARM
  // -------------------------

  Serial.print("Alarm       : ");

  if (alarmState) {

    Serial.println("WARNING - WATER LOW");

  }
  else {

    Serial.println("NORMAL");
  }


  // ==========================================================
  // 10. LCD
  // ==========================================================

  lcd.clear();


  // -------------------------
  // LCD LINE 1
  // Temperature + Humidity
  // -------------------------

  lcd.setCursor(
    0,
    0
  );


  if (!isnan(temperature)) {

    lcd.print("T:");
    lcd.print(
      temperature,
      1
    );
    lcd.print("C ");

  }
  else {

    lcd.print("T:ERR ");
  }


  if (!isnan(humidity)) {

    lcd.print("H:");
    lcd.print(
      humidity,
      0
    );
    lcd.print("%");

  }
  else {

    lcd.print("H:ERR");
  }


  // -------------------------
  // LCD LINE 2
  // Water + Pump
  // -------------------------

  lcd.setCursor(
    0,
    1
  );


  if (waterLevel >= 0) {

    lcd.print("W:");
    lcd.print(
      waterLevel,
      0
    );
    lcd.print("% ");

  }
  else {

    lcd.print("W:ERR ");
  }


  lcd.print("P:");

  if (pumpState) {

    lcd.print("ON");

  }
  else {

    lcd.print("OFF");
  }


  // ==========================================================
  // LOOP DELAY
  // ==========================================================

  delay(2000);
}
