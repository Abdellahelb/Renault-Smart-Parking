const { Pool } = require('pg');
const uuidv4 = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Create a pool using environment variables
if (!process.env.POSTGRES_URL) {
  logger.error('❌ FATAL ERROR: POSTGRES_URL is not defined in environment variables.');
  logger.error('Please add POSTGRES_URL to your .env file or Vercel environment.');
}

let pool = null;
if (process.env.POSTGRES_URL) {
  pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });
}

/**
 * Executes a SQL query with parameters.
 */
async function query(text, params) {
  const pgUrl = process.env.POSTGRES_URL || '';
  const isPlaceholder = pgUrl === '' || 
                       pgUrl.includes('localhost') || 
                       pgUrl.includes('user:password') || 
                       pgUrl.includes('YOUR_POSTGRES_URL') ||
                       pgUrl.startsWith('postgres://username:password');
  
  // Mock mode for local testing if POSTGRES_URL is missing or a placeholder
  if (!process.env.POSTGRES_URL || isPlaceholder) {
    const textLower = text.toLowerCase();

    // Specific Lot State (Maps / Parking Spots) - HIGH PRIORITY
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
        const blocks = { A: 20, B: 30, C: 36, D: 36, E: 36, F: 36, G: 36, H: 36, I: 36 }; // Sum = 302
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

    // Auth: Login ADMIN001
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

    // Dashboard: System Settings
    if (textLower.includes('from system_settings where key = $1')) {
      return { rows: [{ value: '15' }] };
    }

    // Dashboard: Summary counts
    if (textLower.includes('select count(*)')) {
      const isOccupied = textLower.includes("status != 'empty'");
      const isAlert = textLower.includes("status in ('occupied','alert')");
      return { rows: [{ count: isAlert ? '5' : (isOccupied ? '45' : '334') }] };
    }

    // Lots management (Admin/Virtual list)
    if (textLower.includes('from parking_lots')) {
      const rows = [
        { id: '2d69f4ac-0efd-4812-bdf6-d62e1d27bb69', name: 'Park RHL', type: 'physical', total_spots: 302, active: 1, created_at: '2026-05-01T10:00:00Z', total_spots_actual: 302, occupied_count: 45 },
        { id: '83943c3a-a562-4749-b9d2-d55faad8913f', name: 'Park Cantine', type: 'physical', total_spots: 42, active: 1, created_at: '2026-05-01T11:00:00Z', total_spots_actual: 42, occupied_count: 5 }
      ];
      return { rows, rowCount: rows.length };
    }

    // Virtual Lot Stats (inside /virtual route)
    if (textLower.includes('count(*)') && textLower.includes('lot_id = $1')) {
      return { rows: [{ spots: 100, occupied: 15 }] };
    }

    // Dashboard: Block stats / Saturation
    if (textLower.includes('group by') && (textLower.includes('block') || textLower.includes('coalesce'))) {
      return {
        rows: [
          { name: 'A', capacity: 20, vehicles: 8 },
          { name: 'B', capacity: 30, vehicles: 12 },
          { name: 'C', capacity: 36, vehicles: 15 },
          { name: 'Park Cantine', capacity: 42, vehicles: 5 },
          { name: 'Park RHL', capacity: 292, vehicles: 45 }
        ]
      };
    }


    // Dwell time / Avg Days
    if (textLower.includes('avg(')) {
      return { rows: [{ avg: '3.5' }] };
    }

    // Flow Data (Charts)
    if (textLower.includes('group by date_val')) {
      return {
        rows: [
          { date_val: '2026-05-05', entries: 12, exits: 8 },
          { date_val: '2026-05-06', entries: 15, exits: 10 },
          { date_val: '2026-05-07', entries: 20, exits: 14 },
          { date_val: '2026-05-08', entries: 18, exits: 22 },
          { date_val: '2026-05-09', entries: 10, exits: 5 },
          { date_val: '2026-05-10', entries: 5, exits: 2 }
        ]
      };
    }

    // Recent activity
    if (textLower.includes('from vehicle_history')) {
      return { rows: [] };
    }

    // Final fallback for any other unhandled queries in Mock Mode
    return { rows: [], rowCount: 1 }; // Return 1 to satisfy success checks for UPDATE/INSERT
  }

  // Real Database Path (Postgres)
  if (!pool && process.env.POSTGRES_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
    } catch (e) {
      logger.error('Failed to initialize database pool:', e.message);
    }
  }

  if (!pool) {
    throw new Error('Database pool not initialized. POSTGRES_URL might be missing or invalid.');
  }

  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    return res;
  } catch (err) {
    logger.error('Query error:', err.message, { text });
    throw err;
  }
}

/**
 * Initialize the database tables if they don't exist.
 * Called once at server startup or via a setup script.
 */
async function initDatabase() {
  if (!process.env.POSTGRES_URL) {
    logger.info('Skipping DB init (Mock Mode active)');
    return;
  }
  logger.info('🏛️ Initializing PostgreSQL database...');
  
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        operator_id TEXT UNIQUE NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator',
        active INTEGER NOT NULL DEFAULT 1,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS invite_codes (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        role_grant TEXT NOT NULL DEFAULT 'operator',
        created_by TEXT NOT NULL,
        used_by TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS parking_lots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'physical',
        total_spots INTEGER NOT NULL,
        width REAL,
        length REAL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS parking_spots (
        id TEXT PRIMARY KEY,
        lot_id TEXT NOT NULL REFERENCES parking_lots(id),
        spot_label TEXT NOT NULL,
        block TEXT,
        side TEXT,
        position INTEGER,
        status TEXT NOT NULL DEFAULT 'empty',
        vin TEXT,
        operator_id TEXT,
        occupied_at TIMESTAMP,
        car_color TEXT,
        reserved_by TEXT,
        reservation_method TEXT DEFAULT 'manual'
      );

      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        vin TEXT NOT NULL,
        spot_id TEXT REFERENCES parking_spots(id),
        entry_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        exit_at TIMESTAMP,
        operator_id TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS vehicle_history (
        id TEXT PRIMARY KEY,
        vin TEXT NOT NULL,
        spot_id TEXT,
        action TEXT NOT NULL,
        operator_id TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        vin TEXT NOT NULL,
        spot_id TEXT NOT NULL,
        triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        days_parked INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        acknowledged_by TEXT,
        resolved_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        resource TEXT,
        detail TEXT,
        ip_address TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

    `);
    logger.info('✅ Database tables verified/created');

    // Migration: Add missing columns if they don't exist
    try {
      await query('ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS reservation_method TEXT DEFAULT \'manual\'');
      await query('ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS reserved_by TEXT');
      await query('ALTER TABLE parking_spots ADD COLUMN IF NOT EXISTS reservation_subject TEXT');
      logger.info('✅ Database migrations applied');
    } catch (migErr) {
      logger.warn('⚠️ Migration warning (might already be applied):', migErr.message);
    }

    // Ensure system settings exist (Force 15 days for SLA consistency)
    await query("INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", ['max_park_days', '15']);

    logger.info('✅ Database tables verified/created');
    
    // Check if seeding is needed (both admin and lots)
    const { rows: adminRows } = await query('SELECT id FROM users WHERE operator_id = $1', ['ADMIN001']);
    const { rows: lotRows } = await query('SELECT id FROM parking_lots LIMIT 1');
    
    if (adminRows.length === 0 || lotRows.length === 0) {
      await seedDatabase();
    }

  } catch (err) {
    logger.error('💥 Database initialization failed:', err.message);
  }
}

async function seedDatabase() {
  logger.info('🌱 Seeding database...');
  
  try {
    const adminHash = bcrypt.hashSync('admin123', 12);
    const opHash = bcrypt.hashSync('operator123', 12);
    const rtmaHash = bcrypt.hashSync('rtma123', 12);

    await query(`INSERT INTO users (id, name, operator_id, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)`, 
      [uuidv4(), 'Abdellah Elberkaoui', 'ADMIN001', 'a.elberkaoui@renault.com', adminHash, 'admin']);
    
    await query(`INSERT INTO users (id, name, operator_id, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)`, 
      [uuidv4(), 'Jean Dupont', 'OP001', 'j.dupont@renault.com', opHash, 'operator']);
    
    await query(`INSERT INTO users (id, name, operator_id, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)`, 
      [uuidv4(), 'Marie Bernard', 'SUP001', 'm.bernard@renault.com', opHash, 'supervisor']);

    await query(`INSERT INTO users (id, name, operator_id, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)`, 
      [uuidv4(), 'RTMA Engineering', 'RTMA001', 'rtma@renault.com', rtmaHash, 'engineering']);

    // Seed Parking Lots
    const rhlId = uuidv4();
    await query(`INSERT INTO parking_lots (id, name, type, total_spots) VALUES ($1, $2, $3, $4)`, [rhlId, 'Park RHL', 'physical', 292]);

    const contineId = uuidv4();
    await query(`INSERT INTO parking_lots (id, name, type, total_spots) VALUES ($1, $2, $3, $4)`, [contineId, 'Park Cantine', 'physical', 42]);

    // Seed Spots (Simplified for demo)
    const blocks = {
      A: 20, B: 30, C: 36, D: 36, E: 36, F: 36, G: 36, H: 36, I: 36
    };

    const vins = ['VF1RFE00X67123456', 'VF1KA0F09Z1234567', 'VF1BZ000458901234', 'VF1AB000012345678'];
    
    for (const [block, total] of Object.entries(blocks)) {
      for (let i = 1; i <= total; i++) {
        const side = i <= (total / 2) ? 'left' : 'right';
        const status = Math.random() < 0.3 ? 'occupied' : 'empty';
        const vin = status === 'occupied' ? vins[Math.floor(Math.random() * vins.length)] : null;
        
        await query(`INSERT INTO parking_spots (id, lot_id, spot_label, block, side, position, status, vin, occupied_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [uuidv4(), rhlId, `${block}${i}`, block, side, i, status, vin, status === 'occupied' ? new Date() : null]);
      }
    }

    for (let i = 1; i <= 42; i++) {
      await query(`INSERT INTO parking_spots (id, lot_id, spot_label, position, status) VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), contineId, `CT${i}`, i, 'empty']);
    }

    logger.info('✅ Database seeded successfully');
  } catch (err) {
    logger.error('❌ Seeding failed:', err.message);
  }
}

module.exports = {
  query,
  pool,
  initDatabase
};
