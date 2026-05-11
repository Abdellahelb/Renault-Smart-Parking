const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Create a pool using environment variables
let pool = null;
if (process.env.POSTGRES_URL) {
  pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

const uuidv4 = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

/**
 * Executes a SQL query with parameters.
 * Supports a robust Mock Mode for local development and demo purposes.
 */
async function query(text, params) {
  const pgUrl = process.env.POSTGRES_URL || '';
  const isPlaceholder = pgUrl === '' || 
                       pgUrl.includes('localhost') || 
                       pgUrl.includes('user:password') || 
                       pgUrl.includes('YOUR_POSTGRES_URL') ||
                       pgUrl.startsWith('postgres://username:password');
  
  if (!process.env.POSTGRES_URL || isPlaceholder) {
    const textLower = text.toLowerCase();

    // 1. Specific Lot State (Maps / Parking Spots) - HIGHEST PRIORITY
    if (textLower.includes('parking_spots')) {
      const lotId = params && params[0];
      const isCantine = (lotId && lotId.includes('83943c3a')) || textLower.includes('cantine');
      const name = isCantine ? 'Park Cantine' : 'Park RHL';
      const rows = [];
      
      if (isCantine) {
        for (let i = 1; i <= 42; i++) {
          const status = i % 7 === 0 ? 'occupied' : 'empty';
          rows.push({
            id: `CT${i}`, spot_label: `CT${i}`, lot_id: '83943c3a-a562-4749-b9d2-d55faad8913f',
            block: null, status: status, lot_name: name, position: i,
            occupied_at: status === 'occupied' ? '2026-05-10T14:00:00Z' : null, vin: status === 'occupied' ? 'VF1DEMO00X123456' : null
          });
        }
      } else {
        const blocks = { A: 20, B: 30, C: 36, D: 36, E: 36, F: 36, G: 36, H: 36, I: 36 }; // Total = 302
        for (const [block, total] of Object.entries(blocks)) {
          for (let i = 1; i <= total; i++) {
            const side = i <= (total / 2) ? 'left' : 'right';
            const status = (i + block.charCodeAt(0)) % 8 === 0 ? 'occupied' : 'empty';
            rows.push({
              id: `${block}${i}`, spot_label: `${block}${i}`, lot_id: '2d69f4ac-0efd-4812-bdf6-d62e1d27bb69',
              block: block.toUpperCase(), side: side, status: status, lot_name: name, position: i,
              occupied_at: status === 'occupied' ? '2026-05-09T08:00:00Z' : null, vin: status === 'occupied' ? 'VF1RHL00X654321' : null
            });
          }
        }
      }
      return { rows, rowCount: rows.length };
    }

    // 2. Auth: Login ADMIN001
    if (textLower.includes('from users where operator_id = $1')) {
      const opId = params[0] ? params[0].toUpperCase() : '';
      if (opId === 'ADMIN001') {
        return {
          rows: [{
            id: 'mock-admin-id',
            name: 'Mock Admin',
            operator_id: 'ADMIN001',
            password_hash: bcrypt.hashSync('admin123', 10),
            role: 'admin',
            active: 1
          }]
        };
      }
    }

    // 3. Dashboard: System Settings
    if (textLower.includes('from system_settings where key = $1')) {
      return { rows: [{ value: '15' }] };
    }

    // 4. Dashboard: Summary counts
    if (textLower.includes('select count(*)')) {
      const isOccupied = textLower.includes("status != 'empty'");
      const isAlert = textLower.includes("status in ('occupied','alert')");
      return { rows: [{ count: isAlert ? '5' : (isOccupied ? '45' : '344') }] };
    }

    // 5. Lots management
    if (textLower.includes('from parking_lots')) {
      return {
        rows: [
          { id: '2d69f4ac-0efd-4812-bdf6-d62e1d27bb69', name: 'Park RHL', type: 'physical', total_spots: 302, active: 1 },
          { id: '83943c3a-a562-4749-b9d2-d55faad8913f', name: 'Park Cantine', type: 'physical', total_spots: 42, active: 1 }
        ]
      };
    }

    // 6. Block stats / Saturation
    if (textLower.includes('group by') && (textLower.includes('block') || textLower.includes('coalesce'))) {
      return {
        rows: [
          { name: 'A', capacity: 20, vehicles: 8 },
          { name: 'B', capacity: 30, vehicles: 12 },
          { name: 'C', capacity: 36, vehicles: 15 },
          { name: 'Park Cantine', capacity: 42, vehicles: 5 },
          { name: 'Park RHL', capacity: 302, vehicles: 45 }
        ]
      };
    }

    // 7. Fallback for health check or unhandled queries
    if (textLower.includes('select 1')) {
      return { rows: [{ '?column?': 1 }] };
    }

    return { rows: [], rowCount: 0 };
  }

  // Real Database Path
  if (!pool) {
    throw new Error('Database pool not initialized.');
  }

  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    logger.error('Query error:', err.message);
    throw err;
  }
}

async function initDatabase() {
  if (!process.env.POSTGRES_URL) {
    logger.info('Skipping DB init (Mock Mode active)');
    return;
  }
  // (Full Postgres init logic would go here if needed)
}

module.exports = {
  query,
  pool,
  initDatabase
};
