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

// In-memory store for mock mode persistence during demo session
const mockLots = [
  { id: '2d69f4ac-0efd-4812-bdf6-d62e1d27bb69', name: 'Park RHL', type: 'physical', total_spots: 302, active: 1, created_at: new Date().toISOString(), total_spots_actual: 302, occupied_count: 45 },
  { id: '83943c3a-a562-4749-b9d2-d55faad8913f', name: 'Park Cantine', type: 'physical', total_spots: 42, active: 1, created_at: new Date().toISOString(), total_spots_actual: 42, occupied_count: 5 }
];

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

    // 0. Dashboard: Summary counts (Must be checked before general parking_spots query to avoid intercepting COUNT(*) queries)
    if (textLower.includes('select count(*)')) {
      const isOccupied = textLower.includes("status != 'empty'");
      const isAlert = textLower.includes("status in ('occupied','alert')");
      return { rows: [{ count: isAlert ? '5' : (isOccupied ? '45' : '344') }] };
    }

    // 1. Specific Lot State (Maps / Parking Spots) - HIGHEST PRIORITY
    if (textLower.includes('parking_spots') && !textLower.includes('group by')) {
      const lotId = params && params[0];
      const lot = (lotId && typeof lotId === 'string') ? (mockLots.find(l => l.id === lotId) || {}) : {};
      const isCantine = textLower.includes('cantine') || (lotId && typeof lotId === 'string' && lotId.includes('83943c3a'));
      const isRHL = textLower.includes('rhl') || (lotId && typeof lotId === 'string' && lotId.includes('2d69f4ac')) || (!isCantine && (lot.name?.includes('RHL') || !lot.id));
      const name = isCantine ? 'Park Cantine' : (isRHL ? 'Park RHL' : (lot.name || 'Virtual Lot'));
      const rows = [];
      const totalSpots = isCantine ? 42 : (isRHL ? 302 : (lot.total_spots || 100));
      
      if (isCantine) {
        for (let i = 1; i <= 42; i++) {
          const status = i % 7 === 0 ? 'occupied' : 'empty';
          rows.push({
            id: `CT${i}`, spot_label: `CT${i}`, lot_id: lotId || '83943c3a-a562-4749-b9d2-d55faad8913f',
            block: null, status: status, lot_name: name, position: i,
            occupied_at: status === 'occupied' ? '2026-05-10T14:00:00Z' : null, vin: status === 'occupied' ? 'VF1DEMO00X123456' : null
          });
        }
      } else if (isRHL) {
        const blocks = { A: 20, B: 30, C: 36, D: 36, E: 36, F: 36, G: 36, H: 36, I: 36 };
        for (const [block, total] of Object.entries(blocks)) {
          for (let i = 1; i <= total; i++) {
            const side = i <= (total / 2) ? 'left' : 'right';
            const status = (i + block.charCodeAt(0)) % 8 === 0 ? 'occupied' : 'empty';
            rows.push({
              id: `${block}${i}`, spot_label: `${block}${i}`, lot_id: lotId || '2d69f4ac-0efd-4812-bdf6-d62e1d27bb69',
              block: block.toUpperCase(), side: side, status: status, lot_name: name, position: i,
              occupied_at: status === 'occupied' ? '2026-05-09T08:00:00Z' : null, vin: status === 'occupied' ? 'VF1RHL00X654321' : null
            });
          }
        }
      } else {
        // Generic Virtual Lot
        for (let i = 1; i <= totalSpots; i++) {
          const status = i % 10 === 0 ? 'occupied' : 'empty';
          rows.push({
            id: `V${i}`, spot_label: `V${i}`, lot_id: lotId,
            block: 'V', status: status, lot_name: name, position: i,
            occupied_at: status === 'occupied' ? new Date().toISOString() : null
          });
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

    // 4. Dashboard: Summary counts (Handled above)

    if (textLower.includes('select avg(extract')) {
      return { rows: [{ avg: '3.2' }] };
    }

    if (textLower.includes("to_char(timestamp, 'yyyy-mm-dd')")) {
      return {
        rows: [
          { date_val: '2026-05-10', entries: 12, exits: 10 },
          { date_val: '2026-05-11', entries: 15, exits: 14 }
        ]
      };
    }

    if (textLower.includes('extract(day from (current_timestamp - ps.occupied_at))')) {
      return { 
        rows: [{
          spot_label: 'A12', block: 'A', vin: 'VF1CRITICAL', occupied_at: '2026-04-20T10:00:00Z', car_color: '#2D3436', parking: 'Park RHL', days_parked: 20
        }, {
          spot_label: 'B5', block: 'B', vin: 'VF1ALERT00X', occupied_at: '2026-04-25T10:00:00Z', car_color: '#E53935', parking: 'Park RHL', days_parked: 15
        }] 
      };
    }

    // 5. Lots management (Fetch from mockLots)
    if (textLower.includes('from parking_lots')) {
      return { rows: mockLots, rowCount: mockLots.length };
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

    // 7. Generic modifications (DELETE, UPDATE, INSERT)
    if (textLower.includes('insert into parking_lots')) {
      // Mock persistence for new lots
      const id = params[0] || uuidv4();
      const name = params[1];
      const type = params[2];
      const total = params[3];
      mockLots.push({ 
        id, name, type, total_spots: total, total_spots_actual: total, 
        active: 1, created_at: new Date().toISOString(), occupied_count: 0 
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    if (textLower.includes('delete from parking_lots')) {
      const id = params[0];
      const idx = mockLots.findIndex(l => l.id === id);
      if (idx !== -1) mockLots.splice(idx, 1);
      return { rows: [], rowCount: 1 };
    }

    if (textLower.includes('delete') || textLower.includes('update') || textLower.includes('insert')) {
      return { rows: [], rowCount: 1 };
    }

    // 8. Fallback for health check or unhandled queries
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
  
  try {
    logger.info('Checking database schema seeding status...');

    // 0. Ensure pending_messages table exists for ESP32 integration
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_messages (
        device_id VARCHAR(50) PRIMARY KEY,
        message_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 1. Ensure ADMIN001 user exists
    const { rows: adminUser } = await pool.query("SELECT id FROM users WHERE operator_id = 'ADMIN001'");
    if (adminUser.length === 0) {
      logger.info('Seeding default Admin User ADMIN001...');
      const passwordHash = bcrypt.hashSync('admin123', 10);
      await pool.query(`
        INSERT INTO users (id, name, operator_id, email, password_hash, role, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['205a493a-7ba6-48c1-b469-bd9b2b292456', 'Abdellah Elberkaoui', 'ADMIN001', 'a.elberkaoui@renault.com', passwordHash, 'admin', 1]);
    }

    // 2. Ensure Park RHL lot and its 302 spots exist
    const { rows: rhlLots } = await pool.query("SELECT id FROM parking_lots WHERE name = 'Park RHL'");
    if (rhlLots.length === 0) {
      logger.info('Seeding Park RHL Lot and its 302 spots...');
      const lotId = '2d69f4ac-0efd-4812-bdf6-d62e1d27bb69';
      await pool.query("INSERT INTO parking_lots (id, name, type, total_spots) VALUES ($1, $2, $3, $4)", [lotId, 'Park RHL', 'physical', 302]);

      const rhlBlocks = { A: 20, B: 30, C: 36, D: 36, E: 36, F: 36, G: 36, H: 36, I: 36 };
      for (const [block, total] of Object.entries(rhlBlocks)) {
        for (let i = 1; i <= total; i++) {
          const side = i <= (total / 2) ? 'left' : 'right';
          const spotLabel = `${block}${i}`;
          const spotId = `rhl-${block}-${i}`;
          // Deterministically occupied to add mock realistic vehicles on first seed
          const status = (i + block.charCodeAt(0)) % 8 === 0 ? 'occupied' : 'empty';
          const occupiedAt = status === 'occupied' ? new Date(Date.now() - Math.random() * 5 * 86400000).toISOString() : null;
          const vin = status === 'occupied' ? 'VF1RHL00X' + Math.floor(100000 + Math.random() * 900000) : null;
          const carColor = status === 'occupied' ? ['#2D3436', '#E53935', '#1565C0', '#F5F5F5'][Math.floor(Math.random() * 4)] : null;

          await pool.query(`
            INSERT INTO parking_spots (id, lot_id, spot_label, block, side, position, status, vin, occupied_at, car_color, reservation_method)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO NOTHING
          `, [spotId, lotId, spotLabel, block, side, i, status, vin, occupiedAt, carColor, 'manual']);
        }
      }
      logger.info('Park RHL Lot and spots successfully seeded!');
    }

    // 3. Ensure Park Cantine lot and its 42 spots exist
    const { rows: cantineLots } = await pool.query("SELECT id FROM parking_lots WHERE name = 'Park Cantine'");
    if (cantineLots.length === 0) {
      logger.info('Seeding Park Cantine Lot and its 42 spots...');
      const lotId = '83943c3a-a562-4749-b9d2-d55faad8913f';
      await pool.query("INSERT INTO parking_lots (id, name, type, total_spots) VALUES ($1, $2, $3, $4)", [lotId, 'Park Cantine', 'physical', 42]);

      for (let i = 1; i <= 42; i++) {
        const spotLabel = `CT${i}`;
        const spotId = `cantine-ct-${i}`;
        // Deterministically occupied for realistic feel
        const status = i % 10 === 0 ? 'occupied' : 'empty';
        const occupiedAt = status === 'occupied' ? new Date(Date.now() - Math.random() * 3 * 86400000).toISOString() : null;
        const vin = status === 'occupied' ? 'VF1CAN00X' + Math.floor(100000 + Math.random() * 900000) : null;
        const carColor = status === 'occupied' ? '#1565C0' : null;

        await pool.query(`
          INSERT INTO parking_spots (id, lot_id, spot_label, block, side, position, status, vin, occupied_at, car_color, reservation_method)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [spotId, lotId, spotLabel, null, null, i, status, vin, occupiedAt, carColor, 'manual']);
      }
      logger.info('Park Cantine Lot and spots successfully seeded!');
    }

    logger.info('Database self-healing verification completed successfully.');
  } catch (err) {
    logger.error('💥 Database self-healing seeder failed:', err);
    throw err;
  }
}

module.exports = {
  query,
  pool,
  initDatabase
};
