require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');

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
    console.error(err.message);
}

const PORT = process.env.PORT || 3001;
const app = express();
const httpServer = createServer(app);

const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
};

app.use(cors(corsOptions));
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.use(express.json());
app.use(morgan('dev'));

// Socket.io Setup (Conditional for local dev)
let io;
if (process.env.NODE_ENV !== 'production') {
    const { Server } = require('socket.io');
    io = new Server(httpServer, {
        cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', methods: ['GET', 'POST'] }
    });
    io.on('connection', (socket) => {
        logger.info(`🔌 Client connected: ${socket.id}`);
        socket.on('disconnect', () => {
            logger.info(`❌ Client disconnected: ${socket.id}`);
        });
    });
} else {
    // Mock for Vercel
    io = {
        emit: (event, data) => logger.info(`[Socket Mock] Emitted ${event}`),
        on: () => {}
    };
}

// Database Initialization Middleware
let dbInitialized = false;
app.use(async (req, res, next) => {
    // Skip DB init for health check
    if (req.path === '/api/v1/health') return next();
    
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

// Health check
app.get('/api/v1/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        db: dbInitialized ? 'ready' : 'pending'
    });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/vehicles', vehicleRoutes(io));
app.use('/api/v1/parking', parkingRoutes(io));
app.use('/api/v1', parkingRoutes(io)); 
app.use('/api/v1', dashboardRoutes());
app.use('/api/v1', adminRoutes());

app.use((err, req, res, next) => {
    logger.error(`💥 Unhandled error: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Internal server error', detail: process.env.NODE_ENV === 'production' ? undefined : err.message });
});

if (process.env.NODE_ENV !== 'production') {
    httpServer.listen(PORT, () => {
        logger.info(`Server running locally on port ${PORT}`);
    });
}

module.exports = app;
