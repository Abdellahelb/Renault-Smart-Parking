const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'spm-dev-secret-key-change-in-production-2026';
const HARDWARE_API_KEY = process.env.HARDWARE_API_KEY || 'ESP32-DEV-KEY-2026';

function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === HARDWARE_API_KEY) {
        req.user = { id: 'hardware', role: 'operator', name: 'ESP32 Device' };
        return next();
    }

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
        const user = db.prepare('SELECT id, name, operator_id, role, active FROM users WHERE id = ?').get(decoded.userId);
        if (!user || !user.active) return res.status(401).json({ error: 'Invalid or inactive account' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function requireRole(role) {
    const hierarchy = { admin: 3, supervisor: 2, operator: 1 };
    return (req, res, next) => {
        if ((hierarchy[req.user.role] || 0) < (hierarchy[role] || 0)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { authenticate, requireRole, JWT_SECRET };
