const app = require('./backend/server');
const db = require('./backend/src/config/db');

async function test() {
    console.log('Testing backend initialization...');
    try {
        await db.initDatabase();
        console.log('DB init successful (or skipped)');
        
        // Mock a request to health
        const res = { json: (data) => console.log('Health Check Response:', data) };
        const req = { path: '/api/v1/health' };
        
        // Find the health route in app
        // Since it's Express, we can just call it if we find the handler, but it's easier to just start the server.
        console.log('Server loaded successfully');
    } catch (err) {
        console.error('CRITICAL ERROR during initialization:', err);
        process.exit(1);
    }
}

test();
