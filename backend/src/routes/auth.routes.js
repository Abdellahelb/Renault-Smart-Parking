const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const uuidv4 = () => require('crypto').randomUUID();
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticate, requireRole, JWT_SECRET } = require('../middleware/authMiddleware');

const JWT_EXPIRES = '8h';

router.post('/login', async (req, res) => {
    try {
        const { operator_id, password } = req.body;
        if (!operator_id || !password) return res.status(400).json({ error: 'Operator ID and password required' });

        const { rows } = await db.query('SELECT * FROM users WHERE operator_id = $1', [operator_id]);
        const user = rows[0];
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (!user.active) return res.status(403).json({ error: 'Account deactivated' });

        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await db.query(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);

        const token = jwt.sign({ userId: user.id, role: user.role, active: user.active }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await db.query('INSERT INTO audit_log (id, user_id, action, resource, ip_address) VALUES ($1, $2, $3, $4, $5)', 
            [uuidv4(), user.id, 'login', 'auth', req.ip]);

        res.json({
            token,
            user: { id: user.id, name: user.name, operator_id: user.operator_id, email: user.email, role: user.role }
        });
    } catch (err) {
        logger.error('Login error:', err);
        res.status(500).json({ error: 'Login failed', detail: process.env.NODE_ENV === 'production' ? undefined : err.message });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { name, operator_id, password, invite_code } = req.body;
        if (!name || !operator_id || !password) return res.status(400).json({ error: 'All fields required' });

        const password_hash = bcrypt.hashSync(password, 12);
        const userId = uuidv4();

        await db.query(`INSERT INTO users (id, name, operator_id, password_hash, role, active) VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, name, operator_id, password_hash, 'operator', 1]);

        const token = jwt.sign({ userId, role: 'operator', active: 1 }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await db.query('INSERT INTO audit_log (id, user_id, action, resource, ip_address) VALUES ($1, $2, $3, $4, $5)',
            [uuidv4(), userId, 'register', 'auth', req.ip]);

        res.json({
            token,
            user: { id: userId, name, operator_id, role: 'operator' }
        });
    } catch (err) {
        logger.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed', detail: process.env.NODE_ENV === 'production' ? undefined : err.message });
    }
});

module.exports = router;
