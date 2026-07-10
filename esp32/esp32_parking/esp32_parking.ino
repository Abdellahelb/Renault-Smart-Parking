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
// --- Route Scan (Entree / Sortie automatique) ---
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
    Serial.print("Scan recu (Entree/Sortie). VIN : ");
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
// --- Recherche de la place d'un VIN ---
bool queryVehiclePlace(String vin, String &parking, String &place, String &errorMsg) {
    if (token == "") {
        loginToServer();
    }
    HTTPClient http;
    String url = "https://renault-smart-parking-manager-blush.vercel.app/api/v1/vehicles/" + vin;
    http.begin(url);
    http.addHeader("Authorization", "Bearer " + token);
    int httpResponseCode = http.GET();
    if (httpResponseCode == 200) {
        String payload = http.getString();
        StaticJsonDocument<512> res;
        deserializeJson(res, payload);
        place = res["spot_label"].as<String>();
        parking = res["parking_name"].as<String>();
        http.end();
        return true;
    } else if (httpResponseCode == 404) {
        errorMsg = "Vehicule introuvable dans le parking.";
    } else if (httpResponseCode == 401) {
        http.end();
        if (loginToServer()) {
            return queryVehiclePlace(vin, parking, place, errorMsg);
        }
        errorMsg = "Erreur d'authentification.";
        return false;
    } else {
        errorMsg = "Erreur serveur (Code " + String(httpResponseCode) + ")";
    }
    http.end();
    return false;
}
// --- Route Recherche ---
void handleSearchVIN() {
    if (!server.hasArg("plain")) {
        server.send(400, "application/json", "{\"success\":false}");
        return;
    }
    String body = server.arg("plain");
    StaticJsonDocument<128> req;
    deserializeJson(req, body);
    String vin = req["vin"].as<String>();
    vin.trim();
    Serial.print("Recherche de place pour le VIN : ");
    Serial.println(vin);
    String parking = "";
    String place = "";
    String errorMsg = "";
    bool success = queryVehiclePlace(vin, parking, place, errorMsg);
    StaticJsonDocument<256> resp;
    if (success) {
        resp["success"] = true;
        resp["parking"] = parking;
        resp["place"] = place;
        Serial.println("====== VEHICULE RETROUVE ======");
        Serial.print("Parking : "); Serial.println(parking);
        Serial.print("Place : "); Serial.println(place);
        Serial.println("===============================");
    } else {
        resp["success"] = false;
        resp["error"] = errorMsg;
        Serial.println("====== RECHERCHE SANS SUCCES ======");
        Serial.println(errorMsg);
        Serial.println("===================================");
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
    server.on("/search-vin", HTTP_POST, handleSearchVIN);
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
            padding: 10px;
            margin: 0;
        }
        .container {
            max-width: 420px;
            margin: 15px auto;
            background: #1e1e1e;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.6);
        }
        .tabs {
            display: flex;
            background: #151515;
            border-radius: 8px;
            padding: 4px;
            margin-bottom: 20px;
        }
        .tab-btn {
            flex: 1;
            padding: 12px;
            background: none;
            border: none;
            color: #888;
            font-size: 0.95rem;
            font-weight: bold;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s;
            margin: 0;
            width: auto;
        }
        .tab-btn.active {
            background: #2b2b2b;
            color: #F7C948;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
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
            font-size: 1.2rem;
            font-weight: bold;
            padding: 15px;
            border-radius: 8px;
            display: none;
            word-wrap: break-word;
        }
        .success { background: #1b5e20; color: white; }
        .exit-success { background: #b71c1c; color: white; }
        .search-success { background: #1565c0; color: white; }
        .error { background: #551414; color: white; border: 1px solid #8b0000; }
        .preview-img {
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
            color: #aaa;
            margin: 5px 0;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2 style="color: #F7C948; margin-top: 0; margin-bottom: 5px;">RENAULT</h2>
        <p style="margin-top: 0; margin-bottom: 20px; color: #888;">Smart Parking Manager</p>
        
        <!-- Système d'onglets -->
        <div class="tabs">
            <button id="tabAssignBtn" class="tab-btn active" onclick="switchTab('assign')">🚗 Attribuer</button>
            <button id="tabSearchBtn" class="tab-btn" onclick="switchTab('search')">🔍 Rechercher</button>
        </div>
        
        <!-- ONGLET 1 : ATTRIBUTION (ENTREE/SORTIE) -->
        <div id="tabAssign" class="tab-content active">
            <input type="file" id="cameraInputAssign" accept="image/*" capture="environment" style="display: none;">
            <button class="btn-secondary" onclick="document.getElementById('cameraInputAssign').click()">📷 Scanner Photo du VIN</button>
            <img id="previewAssign" class="preview-img" alt="Aperçu">
            <div id="statusAssign" class="status-text">Moteur de scan prêt.</div>
            
            <input type="text" id="vinAssign" placeholder="VIN à attribuer..." autocomplete="off">
            <button class="btn-primary" onclick="sendAssign()">🚗 Enregistrer Entrée/Sortie</button>
            <div id="resultAssign" class="result"></div>
        </div>
        
        <!-- ONGLET 2 : RECHERCHE -->
        <div id="tabSearch" class="tab-content">
            <input type="file" id="cameraInputSearch" accept="image/*" capture="environment" style="display: none;">
            <button class="btn-secondary" onclick="document.getElementById('cameraInputSearch').click()">📷 Scanner VIN à Rechercher</button>
            <img id="previewSearch" class="preview-img" alt="Aperçu">
            <div id="statusSearch" class="status-text">Moteur de scan prêt.</div>
            
            <input type="text" id="vinSearch" placeholder="Saisir VIN à chercher..." autocomplete="off">
            <button class="btn-primary" style="background: #1565c0; color: white;" onclick="sendSearch()">🔍 Chercher la Place</button>
            <div id="resultSearch" class="result"></div>
        </div>
    </div>

    <!-- Moteur OCR Tesseract.js -->
    <script src="https://unpkg.com/tesseract.js@4.0.2/dist/tesseract.min.js"></script>
    <script>
        let worker = null;

        // Commande d'onglet
        function switchTab(tab) {
            document.getElementById('tabAssign').classList.remove('active');
            document.getElementById('tabSearch').classList.remove('active');
            document.getElementById('tabAssignBtn').classList.remove('active');
            document.getElementById('tabSearchBtn').classList.remove('active');
            
            if (tab === 'assign') {
                document.getElementById('tabAssign').classList.add('active');
                document.getElementById('tabAssignBtn').classList.add('active');
            } else {
                document.getElementById('tabSearch').classList.add('active');
                document.getElementById('tabSearchBtn').classList.add('active');
            }
        }

        // Chargement du OCR en arrière-plan
        async function initOCR() {
            try {
                worker = await Tesseract.createWorker({
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            const pct = Math.round(m.progress * 100);
                            document.getElementById('statusAssign').textContent = "Lecture : " + pct + "%";
                            document.getElementById('statusSearch').textContent = "Lecture : " + pct + "%";
                        }
                    }
                });
                await worker.loadLanguage('eng');
                await worker.initialize('eng');
                await worker.setParameters({
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                });
                document.getElementById('statusAssign').textContent = "Lecteur prêt !";
                document.getElementById('statusSearch').textContent = "Lecteur prêt !";
            } catch (err) {
                document.getElementById('statusAssign').textContent = "Erreur OCR : " + err.message;
                document.getElementById('statusSearch').textContent = "Erreur OCR : " + err.message;
            }
        }

        window.addEventListener('load', initOCR);

        // OCR pour l'onglet Attribution (Entrée/Sortie)
        document.getElementById('cameraInputAssign').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const preview = document.getElementById('previewAssign');
            const status = document.getElementById('statusAssign');
            const vinInput = document.getElementById('vinAssign');
            const resultBox = document.getElementById('resultAssign');

            preview.src = URL.createObjectURL(file);
            preview.style.display = "inline-block";
            resultBox.style.display = "none";
            status.textContent = "Analyse de la photo...";

            try {
                if (!worker) await initOCR();
                const { data: { text } } = await worker.recognize(file);
                const cleanedText = text.replace(/[^A-Z0-9]/g, "").trim();
                
                if (cleanedText.length >= 5) {
                    vinInput.value = cleanedText;
                    status.textContent = "VIN détecté !";
                } else {
                    status.textContent = "Échec de lecture, saisissez manuellement.";
                }
            } catch (err) {
                status.textContent = "Erreur d'analyse.";
            }
        });

        // OCR pour l'onglet Recherche (Ultra rapide - Déclenche direct)
        document.getElementById('cameraInputSearch').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const preview = document.getElementById('previewSearch');
            const status = document.getElementById('statusSearch');
            const vinInput = document.getElementById('vinSearch');
            const resultBox = document.getElementById('resultSearch');

            preview.src = URL.createObjectURL(file);
            preview.style.display = "inline-block";
            resultBox.style.display = "none";
            status.textContent = "Analyse de la photo...";

            try {
                if (!worker) await initOCR();
                const { data: { text } } = await worker.recognize(file);
                const cleanedText = text.replace(/[^A-Z0-9]/g, "").trim();
                
                if (cleanedText.length >= 5) {
                    vinInput.value = cleanedText;
                    status.textContent = "VIN détecté ! Lancement recherche...";
                    sendSearch(); // fast operation: déclenche la recherche automatiquement !
                } else {
                    status.textContent = "Échec de lecture. Saisissez à la main.";
                }
            } catch (err) {
                status.textContent = "Erreur d'analyse.";
            }
        });

        // Requête POST d'Attribution
        async function sendAssign() {
            const vinVal = document.getElementById('vinAssign').value.trim().toUpperCase();
            const resultBox = document.getElementById('resultAssign');
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

        // Requête POST de Recherche
        async function sendSearch() {
            const vinVal = document.getElementById('vinSearch').value.trim().toUpperCase();
            const resultBox = document.getElementById('resultSearch');
            if (vinVal.length < 5) {
                alert("Veuillez entrer ou scanner un code VIN valide.");
                return;
            }
            resultBox.style.display = "none";
            try {
                const response = await fetch('/search-vin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vin: vinVal })
                });
                const data = await response.json();
                resultBox.style.display = "block";
                if (data.success) {
                    resultBox.className = "result search-success";
                    resultBox.innerHTML = "🔍 VÉHICULE TROUVÉ !<br>Parking : <b>" + data.parking + "</b><br>Place : <span style='font-size: 2.2rem; color: #F7C948;'>" + data.place + "</span>";
                } else {
                    resultBox.className = "result error";
                    resultBox.textContent = data.error;
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
