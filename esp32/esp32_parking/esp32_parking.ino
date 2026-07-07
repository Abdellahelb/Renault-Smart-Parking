/*
 * ============================================================
 *  RENAULT SMART PARKING - ESP32
 *  WiFi Web Server + Serial Monitor (SANS OLED)
 *  Saisie Intelligente du VIN & Entree/Sortie Automatique
 * ============================================================
 */
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
// --- Paramètres WiFi ---
const char* ssid     = "Orange_wifi_D783";
const char* password = "qLdDaiR6b9G5";
// --- Identifiants API ---
const char* operator_id    = "OPERATOR";
const char* op_password    = "OP001";
const char* login_url      = "https://renault-smart-parking-manager-blush.vercel.app/api/v1/auth/login";
const char* scan_entry_url = "https://renault-smart-parking-manager-blush.vercel.app/api/v1/esp/scan-entry";
const char* scan_exit_url  = "https://renault-smart-parking-manager-blush.vercel.app/api/v1/esp/scan-exit";
WebServer server(80);
String token = "";
// Déclaration de la page web (définie tout en bas)
extern const char HTML_PAGE[];
// --- Connexion WiFi avec Diagnostic ---
void setupWiFi() {
    Serial.println("\n--- Initialisation WiFi ---");
    WiFi.persistent(false); 
    WiFi.disconnect(true);  
    delay(1000);
    
    WiFi.mode(WIFI_STA);
    delay(100);
    // Analyse rapide des réseaux visibles
    int n = WiFi.scanNetworks();
    Serial.print("Analyse terminee : ");
    Serial.print(n);
    Serial.println(" reseaux trouves.");
    for (int i = 0; i < n; ++i) {
        Serial.print("   - ");
        Serial.println(WiFi.SSID(i));
    }
    
    Serial.print("Tentative de connexion a : ");
    Serial.println(ssid);
    
    WiFi.begin(ssid, password);
    
    // Essayer de se connecter (max 20 secondes)
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
        delay(500);
        Serial.print(".");
        attempts++;
        
        // Afficher le statut reel toutes les 5 secondes
        if (attempts % 10 == 0) {
            int status = WiFi.status();
            Serial.print("\n[Statut WiFi] : ");
            if (status == WL_NO_SSID_AVAIL) {
                Serial.println("Reseau introuvable (SSID absent)");
            } else if (status == WL_CONNECT_FAILED) {
                Serial.println("Echec de connexion (Mot de passe incorrect ?)");
            } else if (status == WL_IDLE_STATUS) {
                Serial.println("En attente...");
            } else {
                Serial.println(status);
            }
        }
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connecte avec succes !");
        Serial.print("[WiFi] Adresse IP : http://");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\n[WiFi] Connexion impossible.");
        Serial.print("[WiFi] Statut d'erreur final : ");
        Serial.println(WiFi.status());
    }
    Serial.println("-----------------------------------------\n");
}
// --- Recupere le Token d'authentification ---
bool loginToServer() {
    HTTPClient http;
    http.begin(login_url);
    http.addHeader("Content-Type", "application/json");
    StaticJsonDocument<128> doc;
    doc["operator_id"] = operator_id;
    doc["password"]    = op_password;
    
    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode == 200) {
        String payload = http.getString();
        StaticJsonDocument<512> res;
        deserializeJson(res, payload);
        token = res["token"].as<String>();
        Serial.println("Connexion Vercel reussie !");
        http.end();
        return true;
    } else {
        Serial.print("Erreur de connexion Vercel (Code HTTP : ");
        Serial.print(httpResponseCode);
        Serial.println(")");
        http.end();
        return false;
    }
}
// --- Traitement intelligent du Scan (Entree vs Sortie) ---
bool processScan(String vin, String &place, bool &isExit, String &errorMsg) {
    if (token == "") {
        loginToServer();
    }
    // Étape 1 : Essayer la sortie (scan-exit)
    HTTPClient http;
    http.begin(scan_exit_url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + token);
    StaticJsonDocument<128> doc;
    doc["vin"] = vin;
    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    
    // Si code 200 => Le vehicule etait la, il est sorti et sa place est liberee !
    if (httpResponseCode == 200) {
        String payload = http.getString();
        StaticJsonDocument<256> res;
        deserializeJson(res, payload);
        place = res["place"].as<String>();
        isExit = true;
        http.end();
        return true;
    }
    http.end();
    // Si code 404 => Le vehicule n'et etait pas dans le parking. Donc c'est une ENTREE !
    if (httpResponseCode == 404) {
        http.begin(scan_entry_url);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Authorization", "Bearer " + token);
        
        httpResponseCode = http.POST(requestBody);
        if (httpResponseCode == 200) {
            String payload = http.getString();
            StaticJsonDocument<256> res;
            deserializeJson(res, payload);
            place = res["place"].as<String>();
            isExit = false;
            http.end();
            return true;
        } else if (httpResponseCode == 409) {
            errorMsg = "Parking complet !";
        } else {
            errorMsg = "Erreur entree (Code " + String(httpResponseCode) + ")";
        }
        http.end();
        return false;
    }
    // Si le token a expire (401), se reconnecter et reessayer une fois
    if (httpResponseCode == 401) {
        if (loginToServer()) {
            return processScan(vin, place, isExit, errorMsg);
        }
    }
    errorMsg = "Erreur serveur (Code " + String(httpResponseCode) + ")";
    return false;
}
// --- Route principale (Sert la page HTML) ---
void handleRoot() {
    server.send(200, "text/html", HTML_PAGE);
}
// --- Route Scan ---
void handleScan() {
    if (!server.hasArg("plain")) {
        server.send(400, "application/json", "{\"success\":false}");
        return;
    }
    String body = server.arg("plain");
    StaticJsonDocument<128> req;
    deserializeJson(req, body);
    String vin = req["vin"].as<String>();
    vin.trim();
    Serial.print("Scan recu. VIN : ");
    Serial.println(vin);
    String place = "";
    bool isExit = false;
    String errorMsg = "";
    bool success = processScan(vin, place, isExit, errorMsg);
    StaticJsonDocument<128> resp;
    if (success) {
        resp["success"] = true;
        resp["place"] = place;
        resp["isExit"] = isExit;
        
        if (isExit) {
            Serial.println("====== SORTIE VEHICULE ======");
            Serial.print("Place liberee : ");
            Serial.println(place);
            Serial.println("=============================");
        } else {
            Serial.println("====== ENTREE VEHICULE ======");
            Serial.print("Place assignee : ");
            Serial.println(place);
            Serial.println("=============================");
        }
    } else {
        resp["success"] = false;
        resp["error"] = errorMsg;
        Serial.println("====== ERREUR DE PROCESS ======");
        Serial.println(errorMsg);
        Serial.println("===============================");
    }
    String responseBody;
    serializeJson(resp, responseBody);
    server.send(200, "application/json", responseBody);
}
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    setupWiFi();
    loginToServer();
    server.on("/", HTTP_GET, handleRoot);
    server.on("/scan", HTTP_POST, handleScan);
    server.begin();
    
    Serial.println("Serveur Web ESP32 pret !");
}
void loop() {
    server.handleClient();
    delay(10);
}
// ============================================================
//  CODE HTML DE LA PAGE WEB
// ============================================================
const char HTML_PAGE[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Renault Smart Parking</title>
    <style>
        body {
            background-color: #121212;
            color: white;
            font-family: sans-serif;
            text-align: center;
            padding: 20px;
        }
        .container {
            max-width: 400px;
            margin: auto;
            background: #1e1e1e;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }
        input {
            width: 90%;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border: 1px solid #333;
            background: #2b2b2b;
            color: white;
            font-size: 1.2rem;
            text-transform: uppercase;
            text-align: center;
        }
        button {
            width: 90%;
            padding: 15px;
            margin: 5px 0;
            border: none;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        button:active {
            opacity: 0.8;
        }
        .btn-primary {
            background: #F7C948;
            color: black;
        }
        .btn-secondary {
            background: #333;
            color: white;
            border: 1px solid #444;
        }
        .result {
            margin-top: 20px;
            font-size: 1.3rem;
            font-weight: bold;
            padding: 15px;
            border-radius: 8px;
            display: none;
        }
        .success { background: #1b5e20; color: white; }
        .exit-success { background: #b71c1c; color: white; }
        .error { background: #551414; color: white; border: 1px solid #8b0000; }
        #preview {
            width: 80%;
            max-height: 150px;
            object-fit: contain;
            border-radius: 8px;
            border: 1px solid #444;
            margin-top: 10px;
            display: none;
        }
        .status-text {
            font-size: 0.9rem;
            color: #888;
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2 style="color: #F7C948;">RENAULT</h2>
        <p>Smart Parking Manager</p>
        
        <!-- Input Caméra invisible -->
        <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display: none;">
        
        <!-- Bouton pour déclencher la caméra native -->
        <button class="btn-secondary" onclick="document.getElementById('cameraInput').click()">📷 Prendre Photo du VIN</button>
        
        <!-- Image de preview de la capture -->
        <img id="preview" alt="Aperçu photo">
        
        <!-- Texte d'état pour l'OCR -->
        <div id="statusText" class="status-text">Lecteur prêt.</div>
        
        <!-- Champ texte alimenté automatiquement ou manuellement -->
        <input type="text" id="vin" placeholder="VIN détecté..." autocomplete="off">
        
        <button class="btn-primary" onclick="sendVIN()">🚗 Assigner une place</button>
        
        <div id="resultBox" class="result"></div>
    </div>
    <!-- Chargement du moteur OCR Tesseract.js -->
    <script src="https://unpkg.com/tesseract.js@4.0.2/dist/tesseract.min.js"></script>
    <script>
        const cameraInput = document.getElementById('cameraInput');
        const preview = document.getElementById('preview');
        const statusText = document.getElementById('statusText');
        const vinInput = document.getElementById('vin');
        const resultBox = document.getElementById('resultBox');
        
        let worker = null;
        // Initialisation de Tesseract en arrière-plan
        async function initOCR() {
            statusText.textContent = "Préparation du moteur de lecture...";
            try {
                worker = await Tesseract.createWorker({
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            statusText.textContent = "Lecture : " + Math.round(m.progress * 100) + "%";
                        }
                    }
                });
                await worker.loadLanguage('eng');
                await worker.initialize('eng');
                await worker.setParameters({
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                });
                statusText.textContent = "Lecteur prêt !";
            } catch (err) {
                statusText.textContent = "Erreur lecteur : " + err.message;
            }
        }
        // Démarrage de l'initialisation au chargement de la page
        window.addEventListener('load', initOCR);
        // Gestion de la capture photo
        cameraInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            // Affichage de l'aperçu
            preview.src = URL.createObjectURL(file);
            preview.style.display = "inline-block";
            resultBox.style.display = "none";
            statusText.textContent = "Analyse de l'image...";
            try {
                if (!worker) {
                    await initOCR();
                }
                
                const { data: { text } } = await worker.recognize(file);
                
                // Nettoyage du texte extrait (uniquement lettres majuscules et chiffres)
                const cleanedText = text.replace(/[^A-Z0-9]/g, "").trim();
                
                if (cleanedText.length >= 5) {
                    vinInput.value = cleanedText;
                    statusText.textContent = "VIN détecté avec succès !";
                } else {
                    statusText.textContent = "Lecture difficile, merci de saisir à la main.";
                }
            } catch (err) {
                console.error(err);
                statusText.textContent = "Erreur d'analyse. Saisissez le VIN manuellement.";
            }
        });
        // Envoi du VIN à l'ESP32
        async function sendVIN() {
            const vinVal = vinInput.value.trim().toUpperCase();
            
            if (vinVal.length < 5) {
                alert("Veuillez entrer ou scanner un code VIN valide.");
                return;
            }
            resultBox.style.display = "none";
            try {
                const response = await fetch('/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vin: vinVal })
                });
                
                const data = await response.json();
                resultBox.style.display = "block";
                
                if (data.success) {
                    if (data.isExit) {
                        resultBox.className = "result exit-success";
                        resultBox.innerHTML = "🚗 VÉHICULE SORTI !<br>Place <span style='font-size: 2.2rem; color: #F7C948;'>" + data.place + "</span> libérée.";
                    } else {
                        resultBox.className = "result success";
                        resultBox.innerHTML = "🚗 VÉHICULE ENTRÉ !<br>Place assignée : <span style='font-size: 2.2rem; color: #F7C948;'>" + data.place + "</span>";
                    }
                } else {
                    resultBox.className = "result error";
                    resultBox.textContent = "Erreur : " + data.error;
                }
            } catch (err) {
                resultBox.style.display = "block";
                resultBox.className = "result error";
                resultBox.textContent = "Impossible de contacter l'ESP32.";
            }
        }
    </script>
</body>
</html>
)HTML";
