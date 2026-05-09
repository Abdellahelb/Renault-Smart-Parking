const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db'); // kept in case other middleware need it, or we can remove if unused

const JWT_SECRET = process.env.JWT_SECRET;
const HARDWARE_API_KEY = process.env.HARDWARE_API_KEY;

// Fail-fast on startup if secrets are missing
if (!JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
}

if (!HARDWARE_API_KEY) {
    throw new Error('FATAL ERROR: HARDWARE_API_KEY environment variable is not defined.');
}

const hardwareKeyBuffer = Buffer.from(HARDWARE_API_KEY);

async function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
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
    const hierarchy = { admin: 3, supervisor: 2, operator: 1 };
    return (req, res, next) => {
        if ((hierarchy[req.user.role] || 0) < (hierarchy[role] || 0)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { authenticate, requireRole, JWT_SECRET };
