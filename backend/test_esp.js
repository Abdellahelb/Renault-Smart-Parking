const jwt = require('jsonwebtoken');

const JWT_SECRET = 'super_secure_spm_jwt_secret_key_prod_2026_xyz987!';
const HARDWARE_API_KEY = 'SPM-PROD-HW-KEY-XYZ-987654321';
const BASE_URL = 'https://renault-smart-parking-manager-blush.vercel.app';

// Generate a valid token
const token = jwt.sign({ userId: 'test-admin', role: 'admin', active: 1 }, JWT_SECRET, { expiresIn: '8h' });

async function runTests() {
    console.log("=== RUNNING ESP32 VERIFICATION TESTS ===");
    
    // 2. ENDPOINTS ESP32
    console.log("\n[Test 2.1] POST /api/v1/esp/scan-entry with valid JWT");
    let res = await fetch(`${BASE_URL}/api/v1/esp/scan-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ vin: "TEST-VERIF-001" })
    });
    console.log("Status:", res.status);
    let data = await res.json();
    console.log("Response:", data);
    const assignedPlace = data.place;

    console.log("\n[Test 2.3] GET /api/v1/esp/status?device=entree-1 with correct hardware key");
    res = await fetch(`${BASE_URL}/api/v1/esp/status?device=entree-1`, {
        headers: { 'x-api-key': HARDWARE_API_KEY }
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.json());

    console.log("\n[Test 2.4] GET /api/v1/esp/status?device=entree-1 a second time (should be null)");
    res = await fetch(`${BASE_URL}/api/v1/esp/status?device=entree-1`, {
        headers: { 'x-api-key': HARDWARE_API_KEY }
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.json());

    console.log("\n[Test 2.5] GET /api/v1/esp/status?device=entree-1 WITHOUT hardware key (should be 401)");
    res = await fetch(`${BASE_URL}/api/v1/esp/status?device=entree-1`);
    console.log("Status:", res.status);
    console.log("Response:", await res.json().catch(()=>"No JSON"));

    console.log("\n[Test 2.6] POST /api/v1/esp/scan-exit with valid JWT");
    res = await fetch(`${BASE_URL}/api/v1/esp/scan-exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ vin: "TEST-VERIF-001" })
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.json());

    console.log("\n[Test 2.7] POST /api/v1/esp/scan-exit with invalid VIN");
    res = await fetch(`${BASE_URL}/api/v1/esp/scan-exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ vin: "INEXISTANT-VIN" })
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.json());

    // 3. AUTH JWT
    console.log("\n[Test 3.2] POST /api/v1/esp/scan-entry WITHOUT JWT");
    res = await fetch(`${BASE_URL}/api/v1/esp/scan-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: "TEST-VERIF-002" })
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.json().catch(()=>"No JSON"));

}

runTests().catch(console.error);
