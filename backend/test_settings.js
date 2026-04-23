async function run() {
    try {
        console.log("1. Logging in as admin...");
        const res = await fetch('http://localhost:3001/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operator_id: 'ADMIN01', password: 'admin123' })
        });

        const loginData = await res.json();
        if (!loginData.token) {
            console.error("Login failed!", loginData);
            return;
        }

        const token = loginData.token;
        console.log("Token received.");

        console.log("2. Changing settings to 15 days...");
        const postRes = await fetch('http://localhost:3001/api/v1/settings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ max_park_days: 15 })
        });

        console.log("POST Status:", postRes.status);
        const postBody = await postRes.text();
        console.log("POST Response:", postBody);

        console.log("3. Fetching settings back...");
        const getRes = await fetch('http://localhost:3001/api/v1/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("GET Status:", getRes.status);
        console.log("GET Response:", await getRes.json());

        console.log("4. Checking database directly...");
        const db = require('better-sqlite3')('parking.db');
        console.log("DB value:", db.prepare("SELECT * FROM system_settings").all());

    } catch (e) {
        console.error(e);
    }
}
run();
