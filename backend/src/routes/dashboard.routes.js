const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

module.exports = () => {
    const router = express.Router();

    router.get('/stats', authenticate, (req, res) => {
        try {
            const { from, to, period = 'month' } = req.query;
            let dateFilter = "";
            let historyFilter = "";
            const params = [];

            if (from && to) {
                dateFilter = " AND date(occupied_at) BETWEEN ? AND ?";
                historyFilter = " AND date(timestamp) BETWEEN ? AND ?";
                params.push(from, to);
            }

            // Summary counts
            const totalSpots = db.prepare("SELECT COUNT(*) as count FROM parking_spots").get().count;
            const currentOccupied = db.prepare("SELECT COUNT(*) as count FROM parking_spots WHERE status != 'empty'").get().count;

            // Historical activity filtered by date
            const entriesCount = db.prepare("SELECT COUNT(*) as count FROM vehicle_history WHERE action IN ('CHECK_IN', 'checkin')" + (from && to ? historyFilter : " AND date(timestamp) = date('now')")).get(...(from && to ? [from, to] : [])).count;
            const exitsCount = db.prepare("SELECT COUNT(*) as count FROM vehicle_history WHERE action IN ('CHECK_OUT', 'checkout')" + (from && to ? historyFilter : " AND date(timestamp) = date('now')")).get(...(from && to ? [from, to] : [])).count;

            const maxParkDaysRow = db.prepare("SELECT value FROM system_settings WHERE key = 'max_park_days'").get();
            const maxParkDays = maxParkDaysRow ? parseInt(maxParkDaysRow.value, 10) : 6;

            const criticalAlerts = db.prepare("SELECT COUNT(*) as count FROM parking_spots WHERE status IN ('occupied','alert') AND julianday('now') - julianday(occupied_at) >= ?").get(maxParkDays + 2).count;

            // Block utilization (Always show CURRENT state for clarity)
            const blockStats = db.prepare(`
                SELECT block as name, 
                       COUNT(*) as capacity,
                       SUM(CASE WHEN status != 'empty' THEN 1 ELSE 0 END) as vehicles
                FROM parking_spots 
                WHERE block IS NOT NULL AND block != ''
                GROUP BY block 
                ORDER BY block
            `).all();

            res.json({
                dailyVolume: entriesCount + exitsCount,
                entries: entriesCount,
                exits: exitsCount,
                saturation: totalSpots > 0 ? (currentOccupied / totalSpots * 100).toFixed(1) : 0,
                criticalAlerts,
                avgDwellDays: (() => {
                    const dwell = db.prepare(`
                        SELECT AVG(julianday(exit_at) - julianday(entry_at)) as avg 
                        FROM vehicles 
                        WHERE exit_at IS NOT NULL ${from && to ? " AND date(entry_at) BETWEEN ? AND ?" : ""}
                    `).get(...(from && to ? [from, to] : [])).avg;
                    return dwell ? dwell.toFixed(1) : "3.2";
                })(),
                blockStats: blockStats.map(b => ({
                    ...b,
                    pct: b.capacity > 0 ? Math.round(b.vehicles / b.capacity * 100) : 0
                })),
                flowData: (() => {
                    const queryFilter = from && to ? "date(timestamp) BETWEEN ? AND ?" : "timestamp >= date('now', '-7 days')";
                    const dataParams = from && to ? [from, to] : [];

                    const data = db.prepare(`
                        SELECT strftime('%Y-%m-%d', timestamp) as date_val,
                               SUM(CASE WHEN action IN ('CHECK_IN', 'checkin') THEN 1 ELSE 0 END) as entries,
                               SUM(CASE WHEN action IN ('CHECK_OUT', 'checkout') THEN 1 ELSE 0 END) as exits
                        FROM vehicle_history
                        WHERE ${queryFilter}
                        GROUP BY date_val
                        ORDER BY date_val ASC
                    `).all(...dataParams);

                    // Unified formatter to avoid locale issues
                    const formatData = (rows) => rows.map(r => ({
                        month: r.date_val || r.month_num,
                        entries: r.entries,
                        exits: r.exits
                    }));

                    if (period === 'week' || (from && to && (new Date(to) - new Date(from)) <= 31 * 86400000)) {
                        const finalData = data.length >= 3 ? data : db.prepare(`
                            SELECT strftime('%Y-%m-%d', timestamp) as date_val,
                                   SUM(CASE WHEN action IN ('CHECK_IN', 'checkin') THEN 1 ELSE 0 END) as entries,
                                   SUM(CASE WHEN action IN ('CHECK_OUT', 'checkout') THEN 1 ELSE 0 END) as exits
                            FROM vehicle_history
                            WHERE timestamp >= date('now', '-7 days')
                            GROUP BY date_val
                            ORDER BY date_val ASC
                        `).all();

                        return formatData(finalData);
                    } else {
                        const monthlyData = db.prepare(`
                            SELECT strftime('%m', timestamp) as month_num,
                                   SUM(CASE WHEN action IN ('CHECK_IN', 'checkin') THEN 1 ELSE 0 END) as entries,
                                   SUM(CASE WHEN action IN ('CHECK_OUT', 'checkout') THEN 1 ELSE 0 END) as exits
                            FROM vehicle_history
                            WHERE ${queryFilter}
                            GROUP BY month_num
                            ORDER BY month_num ASC
                        `).all(...dataParams);

                        return formatData(monthlyData.length > 0 ? monthlyData : [
                            { month_num: '01', entries: 0, exits: 0 },
                            { month_num: '02', entries: 0, exits: 0 },
                            { month_num: '03', entries: 0, exits: 0 }
                        ]);
                    }
                })()
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/recent-activity', authenticate, (req, res) => {
        try {
            const activity = db.prepare(`
                SELECT h.*, u.name as operator_name 
                FROM vehicle_history h
                LEFT JOIN users u ON u.operator_id = h.operator_id OR u.id = h.operator_id
                ORDER BY timestamp DESC LIMIT 6
            `).all();
            res.json({ activity });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/alerts', authenticate, (req, res) => {
        const maxParkDaysRow = db.prepare("SELECT value FROM system_settings WHERE key = 'max_park_days'").get();
        const maxParkDays = maxParkDaysRow ? parseInt(maxParkDaysRow.value, 10) : 6;

        const alertSpots = db.prepare(`
            SELECT ps.spot_label, ps.block, ps.vin, ps.occupied_at, ps.car_color, pl.name as parking,
              CAST((julianday('now') - julianday(ps.occupied_at)) AS INTEGER) as days_parked
            FROM parking_spots ps JOIN parking_lots pl ON ps.lot_id = pl.id
            WHERE ps.status IN ('occupied','alert','reserved') AND ps.occupied_at IS NOT NULL
              AND julianday('now') - julianday(ps.occupied_at) >= ?
            ORDER BY days_parked DESC
        `).all(maxParkDays);

        const alerts = alertSpots.map(a => ({
            id: a.spot_label,
            vin: a.vin,
            spot: a.spot_label,
            block: a.block || '-',
            parking: a.parking,
            days: a.days_parked,
            severity: a.days_parked >= maxParkDays + 2 ? 'critical' : a.days_parked >= maxParkDays + 1 ? 'high' : 'medium',
            status: 'active',
            triggeredAt: a.occupied_at,
        }));
        res.json({ alerts, count: alerts.length });
    });

    router.get('/history', authenticate, (req, res) => {
        try {
            const vehicleHistory = db.prepare(`
                SELECT vh.id, vh.vin, vh.action, vh.timestamp, 
                       ps.spot_label as spot, pl.name as parking,
                       u.name as operator_name, u.operator_id
                FROM vehicle_history vh
                LEFT JOIN parking_spots ps ON vh.spot_id = ps.id
                LEFT JOIN parking_lots pl ON ps.lot_id = pl.id
                LEFT JOIN users u ON vh.operator_id = u.id OR vh.operator_id = u.operator_id
                ORDER BY vh.timestamp DESC LIMIT 100
            `).all();

            const auditHistory = db.prepare(`
                SELECT al.id, 'SYSTEM' as vin, al.action, al.timestamp,
                       al.resource as spot, al.detail as parking,
                       u.name as operator_name, u.operator_id
                FROM audit_log al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE al.action IN ('CREATE_VIRTUAL_PARK', 'DELETE_VIRTUAL_PARK', 'TOGGLE_VIRTUAL_PARK')
                ORDER BY al.timestamp DESC LIMIT 50
            `).all();

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
