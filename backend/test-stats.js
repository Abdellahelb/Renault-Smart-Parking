const axios = require('axios');

async function testStats() {
    const baseUrl = 'http://localhost:3001/api/v1';
    try {
        // First log in to get a token
        const loginRes = await axios.post(`${baseUrl}/auth/login`, {
            operator_id: 'ADMIN001',
            password: 'admin123'
        });
        const token = loginRes.data.token;

        // Fetch weekly stats
        const now = new Date();
        const from = '2026-03-29'; // Sunday
        const to = '2026-04-04';   // Saturday
        const statsRes = await axios.get(`${baseUrl}/stats?from=${from}&to=${to}&period=week`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('--- STATS RESPONSE ---');
        console.log(JSON.stringify(statsRes.data, null, 2));
    } catch (err) {
        console.error('Error fetching stats:', err.response?.data || err.message);
    }
}

testStats();
