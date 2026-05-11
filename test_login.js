// const fetch = require('node-fetch');

async function test() {
    try {
        const res = await fetch('http://localhost:3001/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operator_id: 'ADMIN001', password: 'admin123' })
        });
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Data:', data);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
