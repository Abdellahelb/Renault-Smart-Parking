const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

module.exports = () => {
    const router = express.Router();

    router.get('/users', authenticate, requireRole('supervisor'), (req, res) => {
        const users = db.prepare('SELECT id, name, operator_id, email, role, active, created_at, last_login FROM users ORDER BY created_at DESC').all();
        res.json({ users });
    });

    router.post('/users', authenticate, requireRole('supervisor'), (req, res) => {
        try {
            const { name, operator_id, email, role, password } = req.body;
            if (!name || !operator_id || !role || !password) {
                return res.status(400).json({ error: 'Name, operator ID, role, and password are required' });
            }

            if (role === 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Supervisors cannot create admin users' });
            }

            const existing = db.prepare('SELECT id FROM users WHERE operator_id = ?').get(operator_id);
            if (existing) return res.status(409).json({ error: 'Operator ID already exists' });

            const bcrypt = require('bcryptjs');
            const { v4: uuidv4 } = require('uuid');
            const hash = bcrypt.hashSync(password, 12);
            const userId = uuidv4();

            db.prepare('INSERT INTO users (id, name, operator_id, email, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(userId, name, operator_id, email || null, hash, role, req.user.id);

            res.status(201).json({ id: userId, name, operator_id, role });
        } catch (err) {
            console.error('Error creating user:', err);
            res.status(500).json({ error: 'Failed to create user' });
        }
    });

    router.delete('/users/:id', authenticate, requireRole('supervisor'), (req, res) => {
        try {
            const { id } = req.params;
            if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

            const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
            if (targetUser && targetUser.role === 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Supervisors cannot delete admin users' });
            }

            const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
            if (result.changes === 0) return res.status(404).json({ error: 'User not found' });

            res.json({ message: 'User deleted successfully' });
        } catch (err) {
            console.error('Error deleting user:', err);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    });

    router.get('/audit-log', authenticate, requireRole('supervisor'), (req, res) => {
        const logs = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100').all();
        res.json({ logs });
    });

    router.get('/settings', authenticate, requireRole('supervisor'), (req, res) => {
        const settings = db.prepare('SELECT key, value FROM system_settings').all();
        const settingsObj = {};
        for (let s of settings) settingsObj[s.key] = s.value;
        res.json(settingsObj);
    });

    router.post('/settings', authenticate, requireRole('supervisor'), (req, res) => {
        console.log('POST /settings req.body:', req.body);
        const { max_park_days } = req.body;
        if (max_park_days !== undefined) {
            try {
                db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)")
                    .run('max_park_days', max_park_days.toString());
                console.log('Saved max_park_days to DB:', max_park_days);
                res.json({ message: 'Settings updated' });
            } catch (err) {
                console.error('Failed to save settings to DB:', err);
                res.status(500).json({ error: 'DB Save failed' });
            }
        } else {
            console.log('max_park_days not in req.body');
            res.status(400).json({ error: 'max_park_days is required' });
        }
    });

    return router;
};
