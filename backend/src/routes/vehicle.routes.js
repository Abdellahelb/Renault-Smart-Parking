const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate } = require('../middleware/authMiddleware');

module.exports = (io) => {
    const router = express.Router();

    // FIRST SCAN -> CHECKIN | SECOND SCAN -> CHECKOUT
    router.post('/checkin', authenticate, async (req, res) => {
        const { vin } = req.body;
        if (!vin) return res.status(400).json({ error: 'VIN required' });

        if (vin.length !== 17 || /[IOQ]/i.test(vin) || !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
            return res.status(400).json({ error: 'Invalid VIN format (17 alphanumeric chars, no I/O/Q)' });
        }

        try {
            const { rows: existingRows } = await db.query(`
                SELECT ps.*, pl.name as parking_name FROM parking_spots ps
                JOIN parking_lots pl ON ps.lot_id = pl.id
                WHERE ps.vin = $1 AND ps.status IN ('occupied', 'reserved', 'alert')
            `, [vin.toUpperCase()]);
            const existingSpot = existingRows[0];

            if (existingSpot) {
                await db.query('UPDATE parking_spots SET status = $1, vin = NULL, operator_id = NULL, occupied_at = NULL WHERE id = $2', 
                    ['empty', existingSpot.id]);

                await db.query('INSERT INTO vehicle_history (id, vin, spot_id, action, operator_id) VALUES ($1, $2, $3, $4, $5)', 
                    [uuidv4(), vin.toUpperCase(), existingSpot.id, 'checkout', req.user.id || req.user.operator_id]);

                io.emit('spot:updated', { spot_id: existingSpot.spot_label, status: 'empty', vin: null, reservation_method: 'manual' });
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

            const { rows: availableRows } = await db.query(`
                SELECT ps.*, pl.name as parking_name FROM parking_spots ps
                JOIN parking_lots pl ON ps.lot_id = pl.id
                WHERE ps.status = 'empty' AND pl.active = 1
                ORDER BY pl.type ASC, pl.name ASC, ps.block ASC, ps.position ASC
                LIMIT 1
            `);
            const availableSpot = availableRows[0];

            if (!availableSpot) {
                return res.status(503).json({ error: 'PARKING_FULL', virtual_available: true });
            }

            const carColors = ['#2D3436', '#E53935', '#1565C0', '#F5F5F5', '#424242'];
            const color = carColors[Math.floor(Math.random() * carColors.length)];

            await db.query(`UPDATE parking_spots SET status = $1, vin = $2, operator_id = $3, occupied_at = CURRENT_TIMESTAMP, car_color = $4, reservation_method = 'scan' WHERE id = $5`, 
                ['occupied', vin.toUpperCase(), req.user.id || req.user.operator_id, color, availableSpot.id]);

            await db.query('INSERT INTO vehicles (id, vin, spot_id, operator_id) VALUES ($1, $2, $3, $4)', 
                [uuidv4(), vin.toUpperCase(), availableSpot.id, req.user.id || req.user.operator_id]);

            await db.query('INSERT INTO vehicle_history (id, vin, spot_id, action, operator_id) VALUES ($1, $2, $3, $4, $5)', 
                [uuidv4(), vin.toUpperCase(), availableSpot.id, 'checkin', req.user.id || req.user.operator_id]);

            io.emit('spot:updated', { spot_id: availableSpot.spot_label, status: 'occupied', vin: vin.toUpperCase(), reservation_method: 'scan' });
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
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/checkout', authenticate, async (req, res) => {
        const { vin } = req.body;
        if (!vin) return res.status(400).json({ error: 'VIN required' });

        try {
            const { rows } = await db.query(`SELECT ps.*, pl.name as parking_name FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id WHERE ps.vin = $1`, 
                [vin.toUpperCase()]);
            const spot = rows[0];
            if (!spot) return res.status(404).json({ error: 'Vehicle not found in any spot' });

            await db.query('UPDATE parking_spots SET status = $1, vin = NULL, operator_id = NULL, occupied_at = NULL WHERE id = $2', 
                ['empty', spot.id]);

            await db.query('INSERT INTO vehicle_history (id, vin, spot_id, action, operator_id) VALUES ($1, $2, $3, $4, $5)', 
                [uuidv4(), vin.toUpperCase(), spot.id, 'checkout', req.user.id]);

            io.emit('spot:updated', { spot_id: spot.spot_label, status: 'empty', vin: null, reservation_method: 'manual' });
            io.emit('vehicle:departed', { vin: vin.toUpperCase(), spot_id: spot.spot_label });

            res.json({ spot: spot.spot_label, block: spot.block, parking: spot.parking_name, status: 'freed' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/search', authenticate, async (req, res) => {
        const { vin, block, status } = req.query;
        let queryStr = `SELECT ps.spot_label, ps.block, ps.status, ps.vin, ps.occupied_at, ps.car_color, ps.operator_id, pl.name as parking
                    FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id WHERE 1=1`;
        const params = [];
        let pIndex = 1;

        if (vin) { queryStr += ` AND ps.vin ILIKE $${pIndex++}`; params.push(`%${vin}%`); }
        if (block) { queryStr += ` AND ps.block = $${pIndex++}`; params.push(block); }
        if (status) { queryStr += ` AND ps.status = $${pIndex++}`; params.push(status); }
        queryStr += ` ORDER BY ps.block, ps.position`;

        try {
            const { rows } = await db.query(queryStr, params);
            res.json({ vehicles: rows, count: rows.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/:vin', authenticate, async (req, res) => {
        try {
            const { rows } = await db.query(`SELECT ps.*, pl.name as parking_name FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id WHERE ps.vin = $1`, 
                [req.params.vin.toUpperCase()]);
            const spot = rows[0];
            if (!spot) return res.status(404).json({ error: 'Vehicle not found' });
            res.json(spot);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
