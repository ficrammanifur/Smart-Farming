#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#define LCD_SDA 21
#define LCD_SCL 22

// Alamat LCD yang umum: 0x27
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(115200);

  // I2C ESP32
  Wire.begin(LCD_SDA, LCD_SCL);

  // Inisialisasi LCD
  lcd.init();
  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SMART FARMING");

  lcd.setCursor(0, 1);
  lcd.print("LCD TEST OK");

  Serial.println("============================");
  Serial.println("LCD I2C TEST");
  Serial.println("============================");
  Serial.println("LCD: OK");
}

void loop() {
  // Tidak ada proses khusus
}
