const express = require('express');
const db = require('../config/db');
const logger = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');
const uuidv4 = () => require('crypto').randomUUID();

module.exports = () => {
    const router = express.Router();

    router.get('/users', authenticate, requireRole('supervisor'), async (req, res) => {
        try {
            const { rows } = await db.query('SELECT id, name, operator_id, email, role, active, created_at, last_login FROM users ORDER BY created_at DESC');
            res.json({ users: rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/users', authenticate, requireRole('supervisor'), async (req, res) => {
        try {
            const { name, operator_id, email, role, password } = req.body;
            if (!name || !operator_id || !role || !password) {
                return res.status(400).json({ error: 'Name, operator ID, role, and password are required' });
            }

            if (role === 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Supervisors cannot create admin users' });
            }

            const { rows: existing } = await db.query('SELECT id FROM users WHERE operator_id = $1', [operator_id]);
            if (existing.length > 0) return res.status(409).json({ error: 'Operator ID already exists' });

            const hash = bcrypt.hashSync(password, 12);
            const userId = uuidv4();

            await db.query('INSERT INTO users (id, name, operator_id, email, password_hash, role, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
                [userId, name, operator_id, email || null, hash, role, req.user.id]);

            res.status(201).json({ id: userId, name, operator_id, role });
        } catch (err) {
            logger.error('Error creating user:', err);
            res.status(500).json({ error: 'Failed to create user', detail: err.message });
        }
    });

    router.delete('/users/:id', authenticate, requireRole('supervisor'), async (req, res) => {
        try {
            const { id } = req.params;
            if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

            const { rows } = await db.query('SELECT role FROM users WHERE id = $1', [id]);
            const targetUser = rows[0];
            if (!targetUser) return res.status(404).json({ error: 'User not found' });

            // Admin is untouchable
            if (targetUser.role === 'admin') {
                return res.status(403).json({ error: 'Admin accounts cannot be deleted' });
            }

            // Mutual restriction: engineering vs supervisor
            if (req.user.role === 'engineering' && targetUser.role === 'supervisor') {
                return res.status(403).json({ error: 'Engineering users cannot delete Supervisors' });
            }
            if (req.user.role === 'supervisor' && targetUser.role === 'engineering') {
                return res.status(403).json({ error: 'Supervisors cannot delete Engineering users' });
            }

            const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });

            res.json({ message: 'User deleted successfully' });
        } catch (err) {
            logger.error('Error deleting user:', err);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    });

    router.get('/audit-log', authenticate, requireRole('supervisor'), async (req, res) => {
        try {
            const { rows } = await db.query('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100');
            res.json({ logs: rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/settings', authenticate, requireRole('supervisor'), async (req, res) => {
        try {
            const { rows } = await db.query('SELECT key, value FROM system_settings');
            const settingsObj = {};
            for (let s of rows) settingsObj[s.key] = s.value;
            res.json(settingsObj);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/settings', authenticate, requireRole('supervisor'), async (req, res) => {
        const { max_park_days } = req.body;
        if (max_park_days !== undefined) {
            try {
                await db.query("INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", 
                    ['max_park_days', max_park_days.toString()]);
                res.json({ message: 'Settings updated' });
            } catch (err) {
                logger.error('Failed to save settings to DB:', err);
                res.status(500).json({ error: 'DB Save failed' });
            }
        } else {
            res.status(400).json({ error: 'max_park_days is required' });
        }
    });

    return router;
};
