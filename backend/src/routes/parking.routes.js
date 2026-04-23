const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

module.exports = (io) => {
    const router = express.Router();

    router.get('/rhl/state', authenticate, (req, res) => {
        const spots = db.prepare(`
            SELECT ps.spot_label, ps.block, ps.side, ps.position, ps.status, ps.vin, ps.occupied_at, ps.car_color, ps.operator_id
            FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id
            WHERE pl.name = 'Parking RHL' ORDER BY ps.block, ps.position
        `).all();

        const enriched = spots.map(s => ({
            ...s,
            id: s.spot_label,
            daysParked: s.occupied_at ? Math.floor((Date.now() - new Date(s.occupied_at).getTime()) / 86400000) : 0,
        }));

        res.json({ spots: enriched, total: enriched.length });
    });

    router.get('/contine/state', authenticate, (req, res) => {
        const spots = db.prepare(`
            SELECT ps.spot_label, ps.block, ps.position, ps.status, ps.vin, ps.occupied_at, ps.car_color, ps.operator_id
            FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id
            WHERE pl.name = 'Parking Contine' ORDER BY ps.position
        `).all();

        const enriched = spots.map(s => ({
            ...s,
            id: s.spot_label,
            daysParked: s.occupied_at ? Math.floor((Date.now() - new Date(s.occupied_at).getTime()) / 86400000) : 0,
        }));

        res.json({ spots: enriched, total: enriched.length });
    });

    // Spot reservation
    router.post('/spots/:id/reserve', authenticate, (req, res) => {
        const { vin } = req.body;
        const spotId = req.params.id;
        const spot = db.prepare('SELECT * FROM parking_spots WHERE (id = ? OR spot_label = ?) AND status = ?').get(spotId, spotId, 'empty');
        if (!spot) return res.status(404).json({ error: 'Spot not available' });

        db.prepare(`UPDATE parking_spots SET status = ?, vin = ?, operator_id = ?, occupied_at = datetime('now') WHERE id = ?`)
            .run('reserved', vin?.toUpperCase() || null, req.user.id, spot.id);

        io.emit('spot:updated', { spot_id: spot.spot_label, status: 'reserved', vin });
        res.json({ spot: spot.spot_label, status: 'reserved' });
    });

    // Spot release
    router.post('/spots/:id/release', authenticate, (req, res) => {
        const { id } = req.params;
        db.transaction(() => {
            const spot = db.prepare('SELECT id, lot_id, spot_label, vin FROM parking_spots WHERE id = ? OR spot_label = ?').get(id, id);
            if (!spot) return res.status(404).json({ error: 'Spot not found' });

            db.prepare(`
                UPDATE parking_spots 
                SET status = 'empty', vin = NULL, occupied_at = NULL, operator_id = NULL 
                WHERE id = ?
            `).run(spot.id);

            db.prepare('INSERT INTO vehicle_history (id, vin, action, spot_id, operator_id) VALUES (?, ?, ?, ?, ?)')
                .run(uuidv4(), spot.vin || 'N/A', 'RELEASED', spot.id, req.user.id);

            io.emit('spot:updated', {
                spot_id: spot.spot_label,
                lot_id: spot.lot_id,
                status: 'empty'
            });
        })();
        res.json({ message: 'Spot released' });
    });

    // Virtual Parking Routes
    router.get('/virtual', authenticate, (req, res) => {
        const virtualLots = db.prepare(`
            SELECT * FROM parking_lots 
            WHERE type = 'virtual' ORDER BY created_at DESC
        `).all();

        const lotsWithStats = virtualLots.map(lot => {
            const stats = db.prepare(`
                SELECT 
                    COUNT(*) as spots,
                    SUM(CASE WHEN status != 'empty' THEN 1 ELSE 0 END) as occupied
                FROM parking_spots WHERE lot_id = ?
            `).get(lot.id);
            return { ...lot, spots: stats.spots, occupied: stats.occupied };
        });
        res.json({ virtualLots: lotsWithStats });
    });

    router.get('/virtual/:id/spots', authenticate, (req, res) => {
        const { id } = req.params;
        try {
            const spots = db.prepare(`
                SELECT ps.*, pl.name as parking 
                FROM parking_spots ps 
                JOIN parking_lots pl ON ps.lot_id = pl.id 
                WHERE pl.id = ?
            `).all(id);
            res.json({ vehicles: spots });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/virtual', authenticate, requireRole('supervisor'), (req, res) => {
        const { name, totalSpots, width, length } = req.body;
        if (!name || !totalSpots) return res.status(400).json({ error: 'Name and totalSpots required' });

        const lotId = uuidv4();
        db.transaction(() => {
            db.prepare('INSERT INTO parking_lots (id, name, type, total_spots, width, length) VALUES (?, ?, ?, ?, ?, ?)')
                .run(lotId, name, 'virtual', totalSpots, width || null, length || null);
            for (let i = 1; i <= totalSpots; i++) {
                db.prepare('INSERT INTO parking_spots (id, lot_id, spot_label, position) VALUES (?, ?, ?, ?)')
                    .run(uuidv4(), lotId, `V${i}`, i);
            }
            db.prepare('INSERT INTO audit_log (id, user_id, action, resource, detail) VALUES (?, ?, ?, ?, ?)')
                .run(uuidv4(), req.user.id, 'CREATE_VIRTUAL_PARK', lotId, `Created virtual park ${name} with ${totalSpots} spots`);
        })();
        res.status(201).json({ id: lotId, name, totalSpots, status: 'created' });
    });

    router.delete('/virtual/:id', authenticate, requireRole('supervisor'), (req, res) => {
        const { id } = req.params;
        db.transaction(() => {
            const lot = db.prepare('SELECT name FROM parking_lots WHERE id = ?').get(id);
            if (!lot) throw new Error('Virtual lot not found');
            db.prepare('DELETE FROM parking_spots WHERE lot_id = ?').run(id);
            db.prepare('DELETE FROM parking_lots WHERE id = ?').run(id);
            db.prepare('INSERT INTO audit_log (id, user_id, action, resource, detail) VALUES (?, ?, ?, ?, ?)')
                .run(uuidv4(), req.user.id, 'DELETE_VIRTUAL_PARK', id, `Deleted virtual park ${lot.name}`);
        })();
        res.json({ message: 'Virtual lot deleted' });
    });

    router.patch('/virtual/:id/toggle', authenticate, requireRole('supervisor'), (req, res) => {
        const lotId = req.params.id;
        const lot = db.prepare('SELECT active, name FROM parking_lots WHERE id = ?').get(lotId);
        if (!lot) return res.status(404).json({ error: 'Lot not found' });

        const newActive = lot.active === 1 ? 0 : 1;
        db.prepare('UPDATE parking_lots SET active = ? WHERE id = ?').run(newActive, lotId);
        db.prepare('INSERT INTO audit_log (id, user_id, action, resource, detail) VALUES (?, ?, ?, ?, ?)')
            .run(uuidv4(), req.user.id, 'TOGGLE_VIRTUAL_PARK', lotId, `Set ${lot.name} to ${newActive ? 'active' : 'inactive'}`);
        res.json({ id: lotId, active: newActive });
    });

    return router;
};
