const express = require('express');
const uuidv4 = () => require('crypto').randomUUID();
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

module.exports = (io) => {
    const router = express.Router();

    router.get('/rhl/state', authenticate, async (req, res) => {
        try {
            const { rows } = await db.query(`
                SELECT ps.spot_label, ps.block, ps.side, ps.position, ps.status, ps.vin, ps.occupied_at, ps.car_color, ps.operator_id, ps.reserved_by, ps.reservation_method, ps.reservation_subject
                FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id
                FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id
                WHERE pl.name = 'Parking RHL' ORDER BY ps.block, ps.position
            `);

            const enriched = rows.map(s => ({
                ...s,
                id: s.spot_label,
                daysParked: s.occupied_at ? Math.floor((Date.now() - new Date(s.occupied_at).getTime()) / 86400000) : 0,
            }));

            res.json({ spots: enriched, total: enriched.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/contine/state', authenticate, async (req, res) => {
        try {
            const { rows } = await db.query(`
                SELECT ps.spot_label, ps.block, ps.position, ps.status, ps.vin, ps.occupied_at, ps.car_color, ps.operator_id, ps.reserved_by, ps.reservation_method, ps.reservation_subject
                FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id
                FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id
                WHERE pl.name = 'Parking Contine' ORDER BY ps.position
            `);

            const enriched = rows.map(s => ({
                ...s,
                id: s.spot_label,
                daysParked: s.occupied_at ? Math.floor((Date.now() - new Date(s.occupied_at).getTime()) / 86400000) : 0,
            }));

            res.json({ spots: enriched, total: enriched.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Spot reservation (Single)
    router.post('/spots/:id/reserve', authenticate, async (req, res) => {
        const { vin, fullName, subject } = req.body;
        const spotId = req.params.id;
        
        try {
            const { rows } = await db.query('SELECT * FROM parking_spots WHERE (id = $1 OR spot_label = $2) AND status = $3', [spotId, spotId, 'empty']);
            const spot = rows[0];
            if (!spot) return res.status(404).json({ error: 'Spot not available' });

            const reservedBy = fullName || null;

            await db.query(`UPDATE parking_spots SET status = $1, vin = $2, reserved_by = $3, reservation_subject = $4, operator_id = $5, occupied_at = CURRENT_TIMESTAMP, reservation_method = 'manual' WHERE id = $6`, 
                ['reserved', vin?.toUpperCase() || null, reservedBy, subject || null, req.user.id, spot.id]);

            io.emit('spot:updated', { spot_id: spot.spot_label, status: 'reserved', vin, reserved_by: reservedBy, reservation_subject: subject, reservation_method: 'manual' });
            res.json({ spot: spot.spot_label, status: 'reserved' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Multiple Reservation
    router.post('/spots/bulk-reserve', authenticate, async (req, res) => {
        const { spotIds, fullName, subject } = req.body;
        if (!Array.isArray(spotIds) || spotIds.length === 0) return res.status(400).json({ error: 'spotIds array is required' });
        if (!fullName) return res.status(400).json({ error: 'fullName is required' });

        const reservedBy = fullName;
        const updatedSpots = [];

        try {
            for (const spotId of spotIds) {
                const { rows } = await db.query('SELECT * FROM parking_spots WHERE (id = $1 OR spot_label = $2) AND status = $3', [spotId, spotId, 'empty']);
                const spot = rows[0];
                if (spot) {
                    await db.query(`UPDATE parking_spots SET status = $1, reserved_by = $2, reservation_subject = $3, operator_id = $4, occupied_at = CURRENT_TIMESTAMP, reservation_method = 'manual' WHERE id = $5`, 
                        ['reserved', reservedBy, subject || null, req.user.id, spot.id]);
                    updatedSpots.push({ spot_id: spot.spot_label, status: 'reserved', reserved_by: reservedBy, reservation_subject: subject });
                }
            }
            updatedSpots.forEach(s => io.emit('spot:updated', { ...s, reservation_method: 'manual' }));
            res.json({ updated: updatedSpots.length, spots: updatedSpots });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Multiple Release
    router.post('/spots/bulk-release', authenticate, async (req, res) => {
        const { spotIds } = req.body;
        if (!Array.isArray(spotIds) || spotIds.length === 0) return res.status(400).json({ error: 'spotIds array is required' });

        const releasedSpots = [];
        try {
            for (const spotId of spotIds) {
                const { rows } = await db.query('SELECT id, spot_label, status, vin, reservation_method FROM parking_spots WHERE id = $1 OR spot_label = $2', [spotId, spotId]);
                const spot = rows[0];
                if (spot) {
                    if (spot.reservation_method === 'scan' || spot.status === 'occupied' || spot.status === 'alert') {
                        // Skip scan-reserved or actual occupied/alert spots in bulk release
                        continue;
                    }
                    await db.query(`
                        UPDATE parking_spots 
                        SET status = 'empty', vin = NULL, reserved_by = NULL, occupied_at = NULL, operator_id = NULL, reservation_method = 'manual'
                        WHERE id = $1
                    `, [spot.id]);

                    await db.query('INSERT INTO vehicle_history (id, vin, action, spot_id, operator_id) VALUES ($1, $2, $3, $4, $5)', 
                        [uuidv4(), spot.vin || 'N/A', 'RELEASED', spot.id, req.user.id]);

                    releasedSpots.push(spot.spot_label);
                    io.emit('spot:updated', { spot_id: spot.spot_label, status: 'empty', reservation_method: 'manual' });
                }
            }
            res.json({ message: 'Spots released', count: releasedSpots.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Spot release
    router.post('/spots/:id/release', authenticate, async (req, res) => {
        const { id } = req.params;
        try {
            const { rows } = await db.query('SELECT id, lot_id, spot_label, vin, reservation_method FROM parking_spots WHERE id = $1 OR spot_label = $2', [id, id]);
            const spot = rows[0];
            if (!spot) return res.status(404).json({ error: 'Spot not found' });

            const { rows: spotStatusRows } = await db.query('SELECT status FROM parking_spots WHERE id = $1', [spot.id]);
            const currentStatus = spotStatusRows[0]?.status;

            if (spot.reservation_method === 'scan' || currentStatus === 'occupied' || currentStatus === 'alert') {
                return res.status(403).json({ 
                    error: 'MANUAL_RELEASE_FORBIDDEN', 
                    message: 'This spot contains an active vehicle (Blue/Red) and can only be released via scan checkout.' 
                });
            }

            await db.query(`
                UPDATE parking_spots 
                SET status = 'empty', vin = NULL, reserved_by = NULL, occupied_at = NULL, operator_id = NULL, reservation_method = 'manual' 
                WHERE id = $1
            `, [spot.id]);

            await db.query('INSERT INTO vehicle_history (id, vin, action, spot_id, operator_id) VALUES ($1, $2, $3, $4, $5)', 
                [uuidv4(), spot.vin || 'N/A', 'RELEASED', spot.id, req.user.id]);

            io.emit('spot:updated', {
                spot_id: spot.spot_label,
                lot_id: spot.lot_id,
                status: 'empty',
                reservation_method: 'manual'
            });
            res.json({ message: 'Spot released' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Lots Management
    router.get('/lots', authenticate, async (req, res) => {
        try {
            const { rows: lots } = await db.query(`
                SELECT pl.*, 
                    COUNT(ps.id) as total_spots_actual,
                    SUM(CASE WHEN ps.status != 'empty' THEN 1 ELSE 0 END) as occupied_count
                FROM parking_lots pl
                LEFT JOIN parking_spots ps ON pl.id = ps.lot_id
                GROUP BY pl.id
                ORDER BY pl.type, pl.created_at DESC
            `);
            res.json({ lots });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/lots/:id/state', authenticate, async (req, res) => {
        const { id } = req.params;
        try {
            const { rows: spots } = await db.query(`
                SELECT ps.*, pl.name as lot_name
                FROM parking_spots ps 
                JOIN parking_lots pl ON ps.lot_id = pl.id 
                WHERE pl.id = $1 OR pl.name = $2
                ORDER BY ps.block, ps.position
            `, [id, id]);
            
            if (spots.length === 0) return res.status(404).json({ error: 'Lot not found' });
            
            const enriched = spots.map(s => ({
                ...s,
                id: s.spot_label,
                daysParked: s.occupied_at ? Math.floor((Date.now() - new Date(s.occupied_at).getTime()) / 86400000) : 0,
            }));

            res.json({ spots: enriched, total: enriched.length, name: spots[0].lot_name });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/lots/physical', authenticate, requireRole('supervisor'), async (req, res) => {
        const { name, blocks } = req.body; // blocks: [{ name: 'A', total: 20, hasSides: true }]
        if (!name || !blocks || !Array.isArray(blocks)) return res.status(400).json({ error: 'Name and blocks array required' });

        const totalSpots = blocks.reduce((acc, b) => acc + (parseInt(b.total) || 0), 0);
        const lotId = uuidv4();

        try {
            await db.query('INSERT INTO parking_lots (id, name, type, total_spots) VALUES ($1, $2, $3, $4)', 
                [lotId, name, 'physical', totalSpots]);
            
            for (const block of blocks) {
                const bName = block.name.toUpperCase();
                const bTotal = parseInt(block.total);
                const bHasSides = block.hasSides;

                for (let i = 1; i <= bTotal; i++) {
                    const side = bHasSides ? (i <= (bTotal / 2) ? 'left' : 'right') : null;
                    await db.query(`
                        INSERT INTO parking_spots (id, lot_id, spot_label, block, side, position) 
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [uuidv4(), lotId, `${bName}${i}`, bName, side, i]);
                }
            }
            
            await db.query('INSERT INTO audit_log (id, user_id, action, resource, detail) VALUES ($1, $2, $3, $4, $5)', 
                [uuidv4(), req.user.id, 'CREATE_PHYSICAL_PARK', lotId, `Created physical park ${name} with ${totalSpots} spots across ${blocks.length} blocks`]);
                
            res.status(201).json({ id: lotId, name, totalSpots, status: 'created' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Virtual Parking Routes
    router.get('/virtual', authenticate, async (req, res) => {
        try {
            const { rows: virtualLots } = await db.query(`
                SELECT * FROM parking_lots 
                WHERE type = 'virtual' ORDER BY created_at DESC
            `);

            const lotsWithStats = await Promise.all(virtualLots.map(async (lot) => {
                const { rows } = await db.query(`
                    SELECT 
                        COUNT(*) as spots,
                        SUM(CASE WHEN status != 'empty' THEN 1 ELSE 0 END) as occupied
                    FROM parking_spots WHERE lot_id = $1
                `, [lot.id]);
                const stats = rows[0];
                return { ...lot, spots: parseInt(stats.spots), occupied: parseInt(stats.occupied || 0) };
            }));
            res.json({ virtualLots: lotsWithStats });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/virtual/:id/spots', authenticate, async (req, res) => {
        const { id } = req.params;
        try {
            const { rows: spots } = await db.query(`
                SELECT ps.*, pl.name as parking 
                FROM parking_spots ps 
                JOIN parking_lots pl ON ps.lot_id = pl.id 
                WHERE pl.id = $1
            `, [id]);
            res.json({ vehicles: spots });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/virtual', authenticate, requireRole('supervisor'), async (req, res) => {
        const { name, totalSpots, width, length } = req.body;
        if (!name || !totalSpots) return res.status(400).json({ error: 'Name and totalSpots required' });

        const lotId = uuidv4();
        try {
            await db.query('INSERT INTO parking_lots (id, name, type, total_spots, width, length) VALUES ($1, $2, $3, $4, $5, $6)', 
                [lotId, name, 'virtual', totalSpots, width || null, length || null]);
            
            for (let i = 1; i <= totalSpots; i++) {
                await db.query('INSERT INTO parking_spots (id, lot_id, spot_label, position) VALUES ($1, $2, $3, $4)', 
                    [uuidv4(), lotId, `V${i}`, i]);
            }
            
            await db.query('INSERT INTO audit_log (id, user_id, action, resource, detail) VALUES ($1, $2, $3, $4, $5)', 
                [uuidv4(), req.user.id, 'CREATE_VIRTUAL_PARK', lotId, `Created virtual park ${name} with ${totalSpots} spots`]);
                
            res.status(201).json({ id: lotId, name, totalSpots, status: 'created' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/lots/:id', authenticate, requireRole('supervisor'), async (req, res) => {
        const { id } = req.params;
        try {
            const { rows } = await db.query('SELECT name, type FROM parking_lots WHERE id = $1', [id]);
            const lot = rows[0];
            if (!lot) return res.status(404).json({ error: 'Lot not found' });
            
            await db.query('DELETE FROM parking_spots WHERE lot_id = $1', [id]);
            await db.query('DELETE FROM parking_lots WHERE id = $1', [id]);
            await db.query('INSERT INTO audit_log (id, user_id, action, resource, detail) VALUES ($1, $2, $3, $4, $5)', 
                [uuidv4(), req.user.id, 'DELETE_PARKING_LOT', id, `Deleted ${lot.type} lot ${lot.name}`]);
            
            res.json({ message: 'Lot deleted successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/virtual/:id', authenticate, requireRole('supervisor'), async (req, res) => {
        const { id } = req.params;
        try {
            const { rows } = await db.query('SELECT name FROM parking_lots WHERE id = $1', [id]);
            const lot = rows[0];
            if (!lot) return res.status(404).json({ error: 'Virtual lot not found' });
            
            await db.query('DELETE FROM parking_spots WHERE lot_id = $1', [id]);
            await db.query('DELETE FROM parking_lots WHERE id = $1', [id]);
            await db.query('INSERT INTO audit_log (id, user_id, action, resource, detail) VALUES ($1, $2, $3, $4, $5)', 
                [uuidv4(), req.user.id, 'DELETE_VIRTUAL_PARK', id, `Deleted virtual park ${lot.name}`]);
            
            res.json({ message: 'Virtual lot deleted' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.patch('/virtual/:id/toggle', authenticate, requireRole('supervisor'), async (req, res) => {
        const lotId = req.params.id;
        try {
            const { rows } = await db.query('SELECT active, name FROM parking_lots WHERE id = $1', [lotId]);
            const lot = rows[0];
            if (!lot) return res.status(404).json({ error: 'Lot not found' });

            const newActive = lot.active === 1 ? 0 : 1;
            await db.query('UPDATE parking_lots SET active = $1 WHERE id = $2', [newActive, lotId]);
            await db.query('INSERT INTO audit_log (id, user_id, action, resource, detail) VALUES ($1, $2, $3, $4, $5)', 
                [uuidv4(), req.user.id, 'TOGGLE_VIRTUAL_PARK', lotId, `Set ${lot.name} to ${newActive ? 'active' : 'inactive'}`]);
            res.json({ id: lotId, active: newActive });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
