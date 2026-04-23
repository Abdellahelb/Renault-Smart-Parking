const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate } = require('../middleware/authMiddleware');

module.exports = (io) => {
    const router = express.Router();

    // FIRST SCAN -> CHECKIN | SECOND SCAN -> CHECKOUT
    router.post('/checkin', authenticate, (req, res) => {
        const { vin } = req.body;
        if (!vin) return res.status(400).json({ error: 'VIN required' });

        if (vin.length !== 17 || /[IOQ]/i.test(vin) || !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
            return res.status(400).json({ error: 'Invalid VIN format (17 alphanumeric chars, no I/O/Q)' });
        }

        const existingSpot = db.prepare(`
            SELECT ps.*, pl.name as parking_name FROM parking_spots ps
            JOIN parking_lots pl ON ps.lot_id = pl.id
            WHERE ps.vin = ? AND ps.status IN ('occupied', 'reserved', 'alert')
        `).get(vin.toUpperCase());

        if (existingSpot) {
            db.prepare('UPDATE parking_spots SET status = ?, vin = NULL, operator_id = NULL, occupied_at = NULL WHERE id = ?')
                .run('empty', existingSpot.id);

            db.prepare('INSERT INTO vehicle_history (id, vin, spot_id, action, operator_id) VALUES (?, ?, ?, ?, ?)')
                .run(uuidv4(), vin.toUpperCase(), existingSpot.id, 'checkout', req.user.id || req.user.operator_id);

            io.emit('spot:updated', { spot_id: existingSpot.spot_label, status: 'empty', vin: null });
            io.emit('vehicle:departed', { vin: vin.toUpperCase(), spot_id: existingSpot.spot_label });

            return res.json({
                action: 'checkout',
                vin: vin.toUpperCase(),
                spot: existingSpot.spot_label,
                block: existingSpot.block,
                parking: existingSpot.parking_name,
                message: `Vehicle sorted so the site freed the spot`
            });
        }

        const availableSpot = db.prepare(`
            SELECT ps.*, pl.name as parking_name FROM parking_spots ps
            JOIN parking_lots pl ON ps.lot_id = pl.id
            WHERE ps.status = 'empty' AND pl.active = 1
            ORDER BY pl.type ASC, pl.name ASC, ps.block ASC, ps.position ASC
            LIMIT 1
        `).get();

        if (!availableSpot) {
            return res.status(503).json({ error: 'PARKING_FULL', virtual_available: true });
        }

        const carColors = ['#2D3436', '#E53935', '#1565C0', '#F5F5F5', '#424242'];
        const color = carColors[Math.floor(Math.random() * carColors.length)];

        db.prepare(`UPDATE parking_spots SET status = ?, vin = ?, operator_id = ?, occupied_at = datetime('now'), car_color = ? WHERE id = ?`)
            .run('occupied', vin.toUpperCase(), req.user.id || req.user.operator_id, color, availableSpot.id);

        db.prepare('INSERT INTO vehicles (id, vin, spot_id, operator_id) VALUES (?, ?, ?, ?)')
            .run(uuidv4(), vin.toUpperCase(), availableSpot.id, req.user.id || req.user.operator_id);

        db.prepare('INSERT INTO vehicle_history (id, vin, spot_id, action, operator_id) VALUES (?, ?, ?, ?, ?)')
            .run(uuidv4(), vin.toUpperCase(), availableSpot.id, 'checkin', req.user.id || req.user.operator_id);

        io.emit('spot:updated', { spot_id: availableSpot.spot_label, status: 'occupied', vin: vin.toUpperCase() });
        io.emit('vehicle:arrived', { vin: vin.toUpperCase(), spot_id: availableSpot.spot_label, operator: req.user.name });

        res.json({
            action: 'checkin',
            vin: vin.toUpperCase(),
            spot: availableSpot.spot_label,
            block: availableSpot.block,
            parking: availableSpot.parking_name,
            lane: availableSpot.side,
            message: `Vehicle assigned to spot ${availableSpot.spot_label}`
        });
    });

    router.post('/checkout', authenticate, (req, res) => {
        const { vin } = req.body;
        if (!vin) return res.status(400).json({ error: 'VIN required' });

        const spot = db.prepare(`SELECT ps.*, pl.name as parking_name FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id WHERE ps.vin = ?`)
            .get(vin.toUpperCase());
        if (!spot) return res.status(404).json({ error: 'Vehicle not found in any spot' });

        db.prepare('UPDATE parking_spots SET status = ?, vin = NULL, operator_id = NULL, occupied_at = NULL WHERE id = ?')
            .run('empty', spot.id);

        db.prepare('INSERT INTO vehicle_history (id, vin, spot_id, action, operator_id) VALUES (?, ?, ?, ?, ?)')
            .run(uuidv4(), vin.toUpperCase(), spot.id, 'checkout', req.user.id);

        io.emit('spot:updated', { spot_id: spot.spot_label, status: 'empty', vin: null });
        io.emit('vehicle:departed', { vin: vin.toUpperCase(), spot_id: spot.spot_label });

        res.json({ spot: spot.spot_label, block: spot.block, parking: spot.parking_name, status: 'freed' });
    });

    router.get('/search', authenticate, (req, res) => {
        const { vin, block, parking, status } = req.query;
        let query = `SELECT ps.spot_label, ps.block, ps.status, ps.vin, ps.occupied_at, ps.car_color, ps.operator_id, pl.name as parking
                    FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id WHERE 1=1`;
        const params = [];

        if (vin) { query += ` AND ps.vin LIKE ?`; params.push(`%${vin}%`); }
        if (block) { query += ` AND ps.block = ?`; params.push(block); }
        if (status) { query += ` AND ps.status = ?`; params.push(status); }
        query += ` ORDER BY ps.block, ps.position`;

        const results = db.prepare(query).all(...params);
        res.json({ vehicles: results, count: results.length });
    });

    router.get('/:vin', authenticate, (req, res) => {
        const spot = db.prepare(`SELECT ps.*, pl.name as parking_name FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id WHERE ps.vin = ?`)
            .get(req.params.vin.toUpperCase());
        if (!spot) return res.status(404).json({ error: 'Vehicle not found' });
        res.json(spot);
    });

    return router;
};
