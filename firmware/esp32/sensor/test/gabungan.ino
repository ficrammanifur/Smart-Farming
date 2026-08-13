#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ==========================================
// PIN CONFIGURATION
// ==========================================

#define RELAY_PUMP  26
#define RELAY_LAMP  27

#define BUZZER_PIN  23

#define LED_RED     25
#define LED_GREEN   33

#define LCD_SDA     21
#define LCD_SCL     22

// ==========================================
// RELAY CONFIGURATION
// Kebanyakan relay module ESP32 = ACTIVE LOW
// ==========================================

#define RELAY_ON    LOW
#define RELAY_OFF   HIGH

// ==========================================
// LCD
// ==========================================

LiquidCrystal_I2C lcd(0x27, 16, 2);


// ==========================================
// FUNCTION LCD
// ==========================================

void showLCD(String line1, String line2) {

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print(line1);

  lcd.setCursor(0, 1);
  lcd.print(line2);
}


// ==========================================
// SEMUA OUTPUT OFF
// ==========================================

void allOff() {

  digitalWrite(RELAY_PUMP, RELAY_OFF);
  digitalWrite(RELAY_LAMP, RELAY_OFF);

  digitalWrite(BUZZER_PIN, LOW);

  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_GREEN, LOW);
}


// ==========================================
// SETUP
// ==========================================

void setup() {

  Serial.begin(115200);

  // Output
  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_LAMP, OUTPUT);

  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);

  // I2C
  Wire.begin(LCD_SDA, LCD_SCL);

  // LCD
  lcd.init();
  lcd.backlight();

  // Pastikan semua mati saat boot
  allOff();

  showLCD(
    "SMART FARMING",
    "SYSTEM TEST"
  );

  Serial.println("==============================");
  Serial.println(" SMART FARMING OUTPUT TEST");
  Serial.println("==============================");

  delay(2000);
}


// ==========================================
// LOOP
// ==========================================

void loop() {

  // ========================================
  // 1. NORMAL
  // ========================================

  allOff();

  digitalWrite(LED_GREEN, HIGH);

  showLCD(
    "SYSTEM STATUS",
    "NORMAL"
  );

  Serial.println("SYSTEM -> NORMAL");
  Serial.println("GREEN LED -> ON");

  delay(5000);


  // ========================================
  // 2. POMPA ON
  // ========================================

  allOff();

  digitalWrite(LED_GREEN, HIGH);

  digitalWrite(RELAY_PUMP, RELAY_ON);

  showLCD(
    "WATER PUMP",
    "ON"
  );

  Serial.println("PUMP RELAY -> ON");

  delay(5000);


  // ========================================
  // 3. LAMPU ON
  // ========================================

  allOff();

  digitalWrite(LED_GREEN, HIGH);

  digitalWrite(RELAY_LAMP, RELAY_ON);

  showLCD(
    "GROW LIGHT",
    "ON"
  );

  Serial.println("LAMP RELAY -> ON");

  delay(5000);


  // ========================================
  // 4. WARNING
  // ========================================

  allOff();

  digitalWrite(LED_RED, HIGH);

  digitalWrite(BUZZER_PIN, HIGH);

  showLCD(
    "WARNING!",
    "WATER LOW"
  );

  Serial.println("WARNING!");
  Serial.println("RED LED -> ON");
  Serial.println("BUZZER -> ON");

  delay(5000);


  // ========================================
  // 5. SEMUA OFF
  // ========================================

  allOff();

  showLCD(
    "TEST COMPLETE",
    "ALL OFF"
  );

  Serial.println("ALL OUTPUT -> OFF");

  delay(2000);
}
