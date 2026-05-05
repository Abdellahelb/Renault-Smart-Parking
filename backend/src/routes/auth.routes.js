const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
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

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await db.query('INSERT INTO audit_log (id, user_id, action, resource, ip_address) VALUES ($1, $2, $3, $4, $5)', 
            [uuidv4(), user.id, 'login', 'auth', req.ip]);

        res.json({
            token,
            user: { id: user.id, name: user.name, operator_id: user.operator_id, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed', detail: err.message });
    }
});

module.exports = router;
