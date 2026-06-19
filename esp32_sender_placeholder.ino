#include <WiFi.h>
#include <HTTPClient.h>

// SolarView Pro V10 - Placeholder ESP32
const char* WIFI_SSID = "INSERISCI_WIFI";
const char* WIFI_PASS = "INSERISCI_PASSWORD";
const char* API_KEY   = "INSERISCI_API_KEY_RENDER";
const char* ENDPOINT  = "https://solarview-pro.onrender.com/api/update";
const unsigned long POST_INTERVAL_MS = 300000; // 5 minuti

unsigned long lastPost = 0;

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nSolarView ESP32 online");
}

void loop() {
  if (millis() - lastPost >= POST_INTERVAL_MS || lastPost == 0) {
    lastPost = millis();
    sendPlaceholderData();
  }
}

void sendPlaceholderData() {
  if (WiFi.status() != WL_CONNECTED) return;

  float pvPowerKw = 3.2;
  float housePowerKw = 1.8;
  float batteryVoltage = 53.4;
  float batteryPowerKw = 1.1; // positivo = carica, negativo = scarica
  float gridPowerKw = 0.0;    // positivo = prelievo, negativo = immissione

  String json = "{";
  json += "\"status\":\"online\",";
  json += "\"pvPowerKw\":" + String(pvPowerKw, 2) + ",";
  json += "\"pvVoltage\":367,";
  json += "\"pvCurrent\":8.7,";
  json += "\"housePowerKw\":" + String(housePowerKw, 2) + ",";
  json += "\"houseVoltage\":230.5,";
  json += "\"houseHz\":50.00,";
  json += "\"batteryVoltage\":" + String(batteryVoltage, 2) + ",";
  json += "\"batteryPowerKw\":" + String(batteryPowerKw, 2) + ",";
  json += "\"batteryCurrent\":20.6,";
  json += "\"batteryTemp\":24.5,";
  json += "\"gridPowerKw\":" + String(gridPowerKw, 2) + ",";
  json += "\"gridVoltage\":231.0,";
  json += "\"gridHz\":49.99";
  json += "}";

  HTTPClient http;
  http.begin(ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  int code = http.POST(json);
  Serial.printf("POST SolarView: %d\n", code);
  http.end();
}
