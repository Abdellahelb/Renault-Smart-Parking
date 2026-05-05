const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

module.exports = () => {
    const router = express.Router();

    router.get('/stats', authenticate, async (req, res) => {
        try {
            const { from, to, period = 'month' } = req.query;
            let historyFilter = "";
            const params = [];

            if (from && to) {
                historyFilter = " AND timestamp::date BETWEEN $1 AND $2";
                params.push(from, to);
            }

            // Summary counts
            const { rows: spotRows } = await db.query("SELECT COUNT(*) as count FROM parking_spots");
            const totalSpots = parseInt(spotRows[0].count);
            
            const { rows: occupiedRows } = await db.query("SELECT COUNT(*) as count FROM parking_spots WHERE status != 'empty'");
            const currentOccupied = parseInt(occupiedRows[0].count);

            // Historical activity
            let entriesQuery = "SELECT COUNT(*) as count FROM vehicle_history WHERE action IN ('CHECK_IN', 'checkin')";
            let exitsQuery = "SELECT COUNT(*) as count FROM vehicle_history WHERE action IN ('CHECK_OUT', 'checkout')";
            
            if (from && to) {
                entriesQuery += historyFilter;
                exitsQuery += historyFilter;
            } else {
                entriesQuery += " AND timestamp::date = CURRENT_DATE";
                exitsQuery += " AND timestamp::date = CURRENT_DATE";
            }

            const { rows: entryRows } = await db.query(entriesQuery, params);
            const entriesCount = parseInt(entryRows[0].count);
            
            const { rows: exitRows } = await db.query(exitsQuery, params);
            const exitsCount = parseInt(exitRows[0].count);

            const { rows: settingsRows } = await db.query("SELECT value FROM system_settings WHERE key = 'max_park_days'");
            const maxParkDays = settingsRows[0] ? parseInt(settingsRows[0].value, 10) : 15;

            const { rows: alertRows } = await db.query("SELECT COUNT(*) as count FROM parking_spots WHERE status IN ('occupied','alert') AND EXTRACT(DAY FROM (CURRENT_TIMESTAMP - occupied_at)) >= $1", [maxParkDays + 2]);
            const criticalAlerts = parseInt(alertRows[0].count);

            // Block utilization
            const { rows: blockStats } = await db.query(`
                SELECT block as name, 
                       COUNT(*) as capacity,
                       SUM(CASE WHEN status != 'empty' THEN 1 ELSE 0 END) as vehicles
                FROM parking_spots 
                WHERE block IS NOT NULL AND block != ''
                GROUP BY block 
                ORDER BY block
            `);

            // Average Dwell Days
            let dwellQuery = "SELECT AVG(EXTRACT(DAY FROM (exit_at - entry_at))) as avg FROM vehicles WHERE exit_at IS NOT NULL";
            if (from && to) dwellQuery += " AND entry_at::date BETWEEN $1 AND $2";
            const { rows: dwellRows } = await db.query(dwellQuery, params);
            const avgDwellDays = dwellRows[0].avg ? parseFloat(dwellRows[0].avg).toFixed(1) : "3.2";

            // Flow Data
            const queryFilter = from && to ? "timestamp::date BETWEEN $1 AND $2" : "timestamp >= CURRENT_DATE - INTERVAL '7 days'";
            const dataParams = from && to ? [from, to] : [];

            const { rows: flowData } = await db.query(`
                SELECT to_char(timestamp, 'YYYY-MM-DD') as date_val,
                       SUM(CASE WHEN action IN ('CHECK_IN', 'checkin') THEN 1 ELSE 0 END) as entries,
                       SUM(CASE WHEN action IN ('CHECK_OUT', 'checkout') THEN 1 ELSE 0 END) as exits
                FROM vehicle_history
                WHERE ${queryFilter}
                GROUP BY date_val
                ORDER BY date_val ASC
            `, dataParams);

            res.json({
                dailyVolume: entriesCount + exitsCount,
                entries: entriesCount,
                exits: exitsCount,
                saturation: totalSpots > 0 ? (currentOccupied / totalSpots * 100).toFixed(1) : 0,
                criticalAlerts,
                avgDwellDays,
                blockStats: blockStats.map(b => ({
                    ...b,
                    vehicles: parseInt(b.vehicles || 0),
                    capacity: parseInt(b.capacity),
                    pct: parseInt(b.capacity) > 0 ? Math.round(parseInt(b.vehicles || 0) / parseInt(b.capacity) * 100) : 0
                })),
                flowData: flowData.map(r => ({
                    month: r.date_val,
                    entries: parseInt(r.entries || 0),
                    exits: parseInt(r.exits || 0)
                }))
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/recent-activity', authenticate, async (req, res) => {
        try {
            const { rows } = await db.query(`
                SELECT h.*, u.name as operator_name 
                FROM vehicle_history h
                LEFT JOIN users u ON u.operator_id = h.operator_id OR u.id = h.operator_id
                ORDER BY timestamp DESC LIMIT 6
            `);
            res.json({ activity: rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/alerts', authenticate, async (req, res) => {
        try {
            const { rows: settingsRows } = await db.query("SELECT value FROM system_settings WHERE key = 'max_park_days'");
            const maxParkDays = settingsRows[0] ? parseInt(settingsRows[0].value, 10) : 15;

            const { rows: alertSpots } = await db.query(`
                SELECT ps.spot_label, ps.block, ps.vin, ps.occupied_at, ps.car_color, pl.name as parking,
                  EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ps.occupied_at)) as days_parked
                FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id
                WHERE ps.status IN ('occupied','alert','reserved') AND ps.occupied_at IS NOT NULL
                  AND EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ps.occupied_at)) >= $1
                ORDER BY days_parked DESC
            `, [maxParkDays]);

            const alerts = alertSpots.map(a => ({
                id: a.spot_label,
                vin: a.vin,
                spot: a.spot_label,
                block: a.block || '-',
                parking: a.parking,
                days: parseInt(a.days_parked),
                severity: a.days_parked >= maxParkDays + 2 ? 'critical' : a.days_parked >= maxParkDays + 1 ? 'high' : 'medium',
                status: 'active',
                triggeredAt: a.occupied_at,
            }));
            res.json({ alerts, count: alerts.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/history', authenticate, async (req, res) => {
        try {
            const { rows: vehicleHistory } = await db.query(`
                SELECT vh.id, vh.vin, vh.action, vh.timestamp, 
                       ps.spot_label as spot, pl.name as parking,
                       u.name as operator_name, u.operator_id
                FROM vehicle_history vh
                LEFT JOIN parking_spots ps ON vh.spot_id = ps.id
                LEFT JOIN parking_lots pl ON ps.lot_id = pl.id
                LEFT JOIN users u ON vh.operator_id = u.id OR vh.operator_id = u.operator_id
                ORDER BY vh.timestamp DESC LIMIT 100
            `);

            const { rows: auditHistory } = await db.query(`
                SELECT al.id, 'SYSTEM' as vin, al.action, al.timestamp,
                       al.resource as spot, al.detail as parking,
                       u.name as operator_name, u.operator_id
                FROM audit_log al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE al.action IN ('CREATE_VIRTUAL_PARK', 'DELETE_VIRTUAL_PARK', 'TOGGLE_VIRTUAL_PARK')
                ORDER BY al.timestamp DESC LIMIT 50
            `);

            const combined = [...vehicleHistory, ...auditHistory].sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            res.json({ history: combined });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
