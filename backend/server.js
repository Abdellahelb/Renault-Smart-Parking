require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Modularized imports
const authRoutes = require('./src/routes/auth.routes');
const vehicleRoutes = require('./src/routes/vehicle.routes');
const parkingRoutes = require('./src/routes/parking.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const adminRoutes = require('./src/routes/admin.routes');
const db = require('./src/config/db');

// ============================================
// CONFIG
// ============================================
const PORT = process.env.PORT || 3001;

// ============================================
// EXPRESS APP
// ============================================
const app = express();
const httpServer = createServer(app);
const corsOptions = {
    origin: '*', // More permissive for Vercel proxying
    credentials: true
};

const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors(corsOptions));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(morgan('dev'));

// ============================================
// DATABASE INIT
// ============================================
// In Vercel, we can't easily wait for this in a top-level startServer
// so we'll just trigger it and let the first request wait if needed,
// or use a simple middleware to ensure DB is ready.
let dbInitialized = false;
app.use(async (req, res, next) => {
    if (!dbInitialized) {
        try {
            await db.initDatabase();
            dbInitialized = true;
            console.log('Database initialized on first request');
        } catch (err) {
            console.error('Database initialization failed:', err);
        }
    }
    next();
});

// ============================================
// ROUTES
// ============================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/vehicles', vehicleRoutes(io));
app.use('/api/v1/parking', parkingRoutes(io));
app.use('/api/v1', parkingRoutes(io)); // For /spots and /virtual (shared)
app.use('/api/v1', dashboardRoutes()); // For /stats, /recent-activity, /alerts, /history
app.use('/api/v1', adminRoutes());     // For /users, /audit-log

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// ============================================
// WEBSOCKET
// ============================================
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// ============================================
// START SERVER (Local only)
// ============================================
if (process.env.NODE_ENV !== 'production') {
    httpServer.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
