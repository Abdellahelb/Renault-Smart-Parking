require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Modularized imports
const { validateConfig } = require('./src/middleware/authMiddleware');
const authRoutes = require('./src/routes/auth.routes');
const vehicleRoutes = require('./src/routes/vehicle.routes');
const parkingRoutes = require('./src/routes/parking.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const adminRoutes = require('./src/routes/admin.routes');
const db = require('./src/config/db');
const logger = require('./src/utils/logger');

// Validate configuration on startup
try {
    validateConfig();
} catch (err) {
    // We log it, but in production Vercel will still show 500 if we let the error propagate or if it crashes later.
    // However, top-level log might show up in Vercel logs.
    console.error(err.message);
}

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
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Restrict in production
    credentials: true
};

const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', methods: ['GET', 'POST'] }
});

app.use(cors(corsOptions));
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.use(express.json());
app.use(morgan('dev'));

// ============================================
// DATABASE INIT
// ============================================
// In Vercel, we can't easily wait for this in a top-level startServer
// so we'll just trigger it and let the first request wait if needed,
// or use a simple middleware to ensure DB is ready.
/* 
// Disabled auto-init to avoid Vercel timeouts. Use a separate migration script instead.
let dbInitialized = false;
app.use(async (req, res, next) => {
    if (!dbInitialized) {
        try {
            await db.initDatabase();
            dbInitialized = true;
            logger.info('Database initialized on first request');
        } catch (err) {
            logger.error('Database initialization failed:', err);
        }
    }
    next();
});
*/

// ============================================
// ROUTES
// ============================================
// Health check
app.get('/api/v1/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

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
    logger.error(`💥 Unhandled error: ${err.message}`, { stack: err.stack });
    
    if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ error: 'Internal server error' });
    } else {
        res.status(500).json({ error: 'Internal server error', detail: err.message, stack: err.stack });
    }
});

// ============================================
// WEBSOCKET
// ============================================
io.on('connection', (socket) => {
    logger.info(`🔌 Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        logger.info(`❌ Client disconnected: ${socket.id}`);
    });
});

// ============================================
// START SERVER (Local only)
// ============================================
if (process.env.NODE_ENV !== 'production') {
    httpServer.listen(PORT, () => {
        logger.info(`Server running locally on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
