const express = require('express');
const router = express.Router();
const db = require('../config/db');

const { authenticate } = require('../middleware/authMiddleware');

// Middleware to verify the ESP API key for hardware
const verifyEspKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.ESP_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    }
    next();
};

// POST /api/v1/esp/scan-entry
// Input: { vin: '...' }
// Output: { success: true, place: 'A1' } or 409
router.post('/scan-entry', authenticate, async (req, res) => {
    const { vin } = req.body;
    if (!vin) {
        return res.status(400).json({ error: 'VIN is required' });
    }

    try {
        // Find the first available empty spot (ordered by position or id)
        const findSpotQuery = `
            SELECT ps.id, ps.spot_label 
            FROM parking_spots ps
            JOIN parking_lots pl ON ps.lot_id = pl.id
            WHERE ps.status = 'empty' AND pl.type = 'physical'
            ORDER BY COALESCE(ps.block, '') ASC, ps.position ASC 
            LIMIT 1
        `;
        const { rows: emptySpots } = await db.query(findSpotQuery);

        if (emptySpots.length === 0) {
            return res.status(409).json({ error: 'Parking complet. Aucune place libre.' });
        }

        const spot = emptySpots[0];

        // Mark it as occupied and set the VIN
        const updateSpotQuery = `
            UPDATE parking_spots 
            SET status = 'occupied', vin = $1, occupied_at = CURRENT_TIMESTAMP 
            WHERE id = $2
        `;
        await db.query(updateSpotQuery, [vin, spot.id]);

        // Upsert pending message for entree-1
        const messageText = `Place ${spot.spot_label}`;
        const upsertMessageQuery = `
            INSERT INTO pending_messages (device_id, message_text, created_at) 
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (device_id) 
            DO UPDATE SET message_text = $2, created_at = CURRENT_TIMESTAMP
        `;
        await db.query(upsertMessageQuery, ['entree-1', messageText]);

        return res.json({ success: true, place: spot.spot_label });
    } catch (err) {
        console.error('Error in scan-entry:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/esp/scan-exit
// Input: { vin: '...' }
// Output: { success: true, place: 'A1' } or 404
router.post('/scan-exit', authenticate, async (req, res) => {
    const { vin } = req.body;
    if (!vin) {
        return res.status(400).json({ error: 'VIN is required' });
    }

    try {
        // Find the spot occupied by this VIN
        const findSpotQuery = `
            SELECT id, spot_label FROM parking_spots 
            WHERE vin = $1 AND status = 'occupied' 
            LIMIT 1
        `;
        const { rows: occupiedSpots } = await db.query(findSpotQuery, [vin]);

        if (occupiedSpots.length === 0) {
            return res.status(404).json({ error: 'Véhicule non trouvé dans le parking.' });
        }

        const spot = occupiedSpots[0];

        // Free the spot
        const freeSpotQuery = `
            UPDATE parking_spots 
            SET status = 'empty', vin = NULL, occupied_at = NULL 
            WHERE id = $1
        `;
        await db.query(freeSpotQuery, [spot.id]);

        // Upsert pending message for sortie-1
        const messageText = `Place ${spot.spot_label} libre`;
        const upsertMessageQuery = `
            INSERT INTO pending_messages (device_id, message_text, created_at) 
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (device_id) 
            DO UPDATE SET message_text = $2, created_at = CURRENT_TIMESTAMP
        `;
        await db.query(upsertMessageQuery, ['sortie-1', messageText]);

        return res.json({ success: true, place: spot.spot_label });
    } catch (err) {
        console.error('Error in scan-exit:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/esp/status?device=xxx
// Output: { message: { text: '...' } } or { message: null }
router.get('/status', verifyEspKey, async (req, res) => {
    const device = req.query.device;
    if (!device) {
        return res.status(400).json({ error: 'Device parameter is required' });
    }

    try {
        // Read the message
        const readMsgQuery = `
            SELECT message_text FROM pending_messages WHERE device_id = $1
        `;
        const { rows: messages } = await db.query(readMsgQuery, [device]);

        if (messages.length === 0) {
            return res.json({ message: null });
        }

        const msgText = messages[0].message_text;

        // Delete the message (acknowledge)
        const deleteMsgQuery = `
            DELETE FROM pending_messages WHERE device_id = $1
        `;
        await db.query(deleteMsgQuery, [device]);

        return res.json({ message: { text: msgText } });
    } catch (err) {
        console.error('Error in esp status:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = () => router;
