const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// --- CONFIGURATION ---
// 1. Assurez-vous d'avoir exporté POSTGRES_URL dans votre terminal avant de lancer le script
// 2. Assurez-vous que JWT_SECRET correspond EXACTEMENT à la valeur sur Vercel
const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_spm_jwt_secret_key_prod_2026_xyz987!';
const HARDWARE_API_KEY = process.env.HARDWARE_API_KEY || 'SPM-PROD-HW-KEY-XYZ-987654321';
const BASE_URL = process.env.API_URL || 'https://renault-smart-parking-manager-blush.vercel.app';

if (!process.env.POSTGRES_URL) {
    console.error("❌ ERREUR : La variable d'environnement POSTGRES_URL n'est pas définie.");
    console.error("Veuillez l'exporter avant d'exécuter ce script.");
    process.exit(1);
}

// 1. SSL PostgreSQL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Générer un token local avec le même JWT_SECRET que Vercel
const token = jwt.sign({ userId: 'test-admin', role: 'admin', active: 1 }, JWT_SECRET, { expiresIn: '8h' });

async function runTests() {
    console.log("=== RUNNING ESP32 & DB VERIFICATION TESTS ===\n");
    let resDb, res, data;

    try {
        // --- 1. BASE DE DONNÉES ---
        console.log("--- 1. BASE DE DONNÉES ---");
        
        resDb = await pool.query("SELECT COUNT(*) FROM parking_spots WHERE lot_id = (SELECT id FROM parking_lots WHERE name = 'Park RHL')");
        console.log(`[Test 1.1] Count Park RHL spots: ${resDb.rows[0].count === '302' ? '✅' : '❌'} (Résultat: ${resDb.rows[0].count})`);

        resDb = await pool.query("SELECT COUNT(*) FROM parking_spots WHERE lot_id = (SELECT id FROM parking_lots WHERE name = 'Park Cantine')");
        console.log(`[Test 1.2] Count Park Cantine spots: ${resDb.rows[0].count === '42' ? '✅' : '❌'} (Résultat: ${resDb.rows[0].count})`);

        resDb = await pool.query("SELECT name, COUNT(*) FROM parking_lots WHERE name IN ('Park RHL', 'Park Cantine') GROUP BY name");
        const noDuplicates = resDb.rows.every(r => r.count === '1');
        console.log(`[Test 1.3] Ensure no duplicate parking_lots: ${noDuplicates ? '✅' : '❌'} (Résultat: ${JSON.stringify(resDb.rows)})`);

        // --- 2. ENDPOINTS ESP32 & 4. AFFECTATION AUTOMATIQUE ---
        console.log("\n--- 2. ENDPOINTS ESP32 ---");
        
        res = await fetch(`${BASE_URL}/api/v1/esp/scan-entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ vin: "TEST-VERIF-001" })
        });
        data = await res.json();
        console.log(`[Test 2.1] POST /api/v1/esp/scan-entry: ${res.status === 200 && data.success ? '✅' : '❌'} (Status: ${res.status}, Place: ${data.place || 'N/A'})`);
        const assignedPlace = data.place;

        if (assignedPlace) {
            resDb = await pool.query("SELECT status, vin FROM parking_spots WHERE spot_label = $1", [assignedPlace]);
            const isOccupiedInDb = resDb.rows[0]?.status === 'occupied' && resDb.rows[0]?.vin === 'TEST-VERIF-001';
            console.log(`[Test 2.2] DB Spot status='occupied': ${isOccupiedInDb ? '✅' : '❌'} (Résultat: ${JSON.stringify(resDb.rows[0])})`);
        } else {
            console.log("[Test 2.2] DB Spot status='occupied': ❌ (Échec car aucune place n'a été assignée au test 2.1)");
        }

        // 2. Correction format message ESP32
        res = await fetch(`${BASE_URL}/api/v1/esp/status?device=entree-1`, { headers: { 'x-api-key': HARDWARE_API_KEY } });
        data = await res.json();
        const msgText = data.message?.text || "";
        console.log(`[Test 2.3] GET /api/v1/esp/status?device=entree-1: ${msgText.includes("Place") ? '✅' : '❌'} (Résultat: ${JSON.stringify(data)})`);

        res = await fetch(`${BASE_URL}/api/v1/esp/status?device=entree-1`, { headers: { 'x-api-key': HARDWARE_API_KEY } });
        data = await res.json();
        console.log(`[Test 2.4] GET /api/v1/esp/status acquittement (should be null): ${data.message === null ? '✅' : '❌'} (Résultat: ${JSON.stringify(data)})`);

        res = await fetch(`${BASE_URL}/api/v1/esp/status?device=entree-1`);
        console.log(`[Test 2.5] GET /status SANS x-api-key (should be 401): ${res.status === 401 ? '✅' : '❌'} (Status: ${res.status})`);

        res = await fetch(`${BASE_URL}/api/v1/esp/scan-exit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ vin: "TEST-VERIF-001" })
        });
        data = await res.json();
        console.log(`[Test 2.6] POST /api/v1/esp/scan-exit: ${res.status === 200 && data.success ? '✅' : '❌'} (Status: ${res.status}, Résultat: ${JSON.stringify(data)})`);

        res = await fetch(`${BASE_URL}/api/v1/esp/scan-exit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ vin: "INEXISTANT-VIN" })
        });
        console.log(`[Test 2.7] POST /api/v1/esp/scan-exit avec faux VIN (should be 404): ${res.status === 404 ? '✅' : '❌'} (Status: ${res.status})`);

        // --- 3. AUTH JWT ---
        console.log("\n--- 3. AUTH JWT ---");
        res = await fetch(`${BASE_URL}/api/v1/esp/scan-entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vin: "TEST-VERIF-002" })
        });
        console.log(`[Test 3.2] POST /scan-entry SANS token (backend rejection): ${res.status === 401 ? '✅' : '❌'} (Status: ${res.status})`);

    } catch (e) {
        console.error("❌ Erreur pendant l'exécution des tests:", e);
    } finally {
        // --- 6. NETTOYAGE ---
        console.log("\n--- 6. NETTOYAGE ---");
        try {
            await pool.query("UPDATE parking_spots SET status = 'empty', vin = NULL, occupied_at = NULL WHERE vin = 'TEST-VERIF-001'");
            await pool.query("DELETE FROM pending_messages WHERE device_id IN ('entree-1', 'sortie-1')");
            console.log("✅ Nettoyage terminé.");
        } catch(e) {
            console.error("❌ Erreur pendant le nettoyage:", e);
        }
        await pool.end();
        console.log("\n=== TESTS TERMINÉS ===");
    }
}

runTests();
