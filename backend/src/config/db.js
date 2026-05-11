const { Pool } = require('pg');
const uuidv4 = () => require('crypto').randomUUID();
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Create a pool using environment variables
if (!process.env.POSTGRES_URL) {
  logger.error('❌ FATAL ERROR: POSTGRES_URL is not defined in environment variables.');
  logger.error('Please add POSTGRES_URL to your .env file or Vercel environment.');
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Required for Vercel/Neon Postgres
  } : false
});

/**
 * Executes a SQL query with parameters.
 */
async function query(text, params) {
  const isPlaceholder = process.env.POSTGRES_URL && (process.env.POSTGRES_URL.includes('localhost') || process.env.POSTGRES_URL.includes('user:password'));
  
  // Mock mode for local testing if POSTGRES_URL is missing or a placeholder
  if (!process.env.POSTGRES_URL || isPlaceholder) {
    const isUserQuery = text.includes('FROM users WHERE operator_id = $1');
    if (isUserQuery) {
      const opId = params[0] ? params[0].toUpperCase() : '';
      if (opId === 'ADMIN001') {
        logger.info('👤 Mock Login matched: ADMIN001');
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
    return { rows: [], rowCount: 0 };
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
