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
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean),
    credentials: true
};

const io = new Server(httpServer, {
    cors: { origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean), methods: ['GET', 'POST'] }
});

app.use(cors(corsOptions));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(morgan('dev'));

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
// START SERVER
// ============================================
const startServer = async () => {
    try {
        await authRoutes.initAdmin ? null : null; // No-op if not needed
        const db = require('./src/config/db');
        await db.initDatabase();

        httpServer.listen(PORT, () => {
            console.log(`
  ╔═══════════════════════════════════════════════╗
  ║   🚗 Smart Parking Manager API (PostgreSQL)   ║
  ║   Running on http://localhost:${PORT}            ║
  ║   Database: Vercel Postgres                   ║
  ║   WebSocket: Enabled                          ║
  ║                                               ║
  ║   Refactor: Persistent Data Mode              ║
  ╚═══════════════════════════════════════════════╝
    `);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
};

startServer();
