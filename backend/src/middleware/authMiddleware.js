const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db'); // kept in case other middleware need it, or we can remove if unused

const JWT_SECRET = process.env.JWT_SECRET || 'spm-fallback-secret-2026';
const HARDWARE_API_KEY = process.env.HARDWARE_API_KEY || null;

function validateConfig() {
    if (!process.env.JWT_SECRET) {
        console.warn('⚠️ JWT_SECRET is not defined in environment. Using fallback secret.');
    }
    if (!process.env.HARDWARE_API_KEY) {
        console.warn('⚠️ HARDWARE_API_KEY is not defined. Hardware authentication will be disabled.');
    }
}

let hardwareKeyBuffer = null;
if (HARDWARE_API_KEY) {
    try {
        hardwareKeyBuffer = Buffer.from(HARDWARE_API_KEY);
    } catch (err) {
        console.error('Failed to initialize hardware key buffer:', err.message);
    }
}

async function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && hardwareKeyBuffer) {
        const inputKeyBuffer = Buffer.from(apiKey);
        if (inputKeyBuffer.length === hardwareKeyBuffer.length && crypto.timingSafeEqual(inputKeyBuffer, hardwareKeyBuffer)) {
            req.user = { id: 'hardware', role: 'operator', name: 'ESP32 Device' };
            return next();
        }
    }

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
        
        // Use JWT payload instead of DB query for performance
        if (!decoded || !decoded.active) {
            return res.status(401).json({ error: 'Invalid or inactive account' });
        }
        
        req.user = {
            id: decoded.userId,
            name: decoded.name,
            operator_id: decoded.operator_id,
            role: decoded.role,
            active: decoded.active
        };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function requireRole(role) {
    const hierarchy = { admin: 3, supervisor: 2, engineering: 2, operator: 1 };
    return (req, res, next) => {
        if ((hierarchy[req.user.role] || 0) < (hierarchy[role] || 0)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { authenticate, requireRole, validateConfig, JWT_SECRET };
