const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../parking.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    operator_id TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('admin','supervisor','engineering','operator')),
    active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    role_grant TEXT NOT NULL DEFAULT 'operator',
    created_by TEXT NOT NULL,
    used_by TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS parking_lots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'physical' CHECK(type IN ('physical','virtual')),
    total_spots INTEGER NOT NULL,
    width REAL,
    length REAL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS parking_spots (
    id TEXT PRIMARY KEY,
    lot_id TEXT NOT NULL,
    spot_label TEXT NOT NULL,
    block TEXT,
    side TEXT,
    position INTEGER,
    status TEXT NOT NULL DEFAULT 'empty' CHECK(status IN ('empty','occupied','reserved','alert')),
    vin TEXT,
    operator_id TEXT,
    occupied_at TEXT,
    car_color TEXT,
    FOREIGN KEY (lot_id) REFERENCES parking_lots(id)
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    vin TEXT NOT NULL,
    spot_id TEXT,
    entry_at TEXT NOT NULL DEFAULT (datetime('now')),
    exit_at TEXT,
    operator_id TEXT,
    notes TEXT,
    FOREIGN KEY (spot_id) REFERENCES parking_spots(id)
  );

  CREATE TABLE IF NOT EXISTS vehicle_history (
    id TEXT PRIMARY KEY,
    vin TEXT NOT NULL,
    spot_id TEXT,
    action TEXT NOT NULL,
    operator_id TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    vin TEXT NOT NULL,
    spot_id TEXT NOT NULL,
    triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
    days_parked INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','acknowledged','resolved')),
    acknowledged_by TEXT,
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    detail TEXT,
    ip_address TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration scripts
try { db.exec("ALTER TABLE parking_lots ADD COLUMN width REAL;"); } catch (e) { }
try { db.exec("ALTER TABLE parking_lots ADD COLUMN length REAL;"); } catch (e) { }
try { db.exec("ALTER TABLE parking_spots ADD COLUMN reserved_by TEXT;"); } catch (e) { }

try { db.exec("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('max_park_days', '6')"); } catch (e) { }

// Seed function
function seedDatabase() {
  const adminExists = db.prepare('SELECT id FROM users WHERE operator_id = ?').get('ADMIN001');
  if (adminExists) return;

  console.log('🌱 Seeding database...');

  const adminHash = bcrypt.hashSync('admin123', 12);
  db.prepare(`INSERT INTO users (id, name, operator_id, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'Abdellah Elberkaoui', 'ADMIN001', 'a.elberkaoui@renault.com', adminHash, 'admin');

  const opHash = bcrypt.hashSync('operator123', 12);
  db.prepare(`INSERT INTO users (id, name, operator_id, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'Jean Dupont', 'OP001', 'j.dupont@renault.com', opHash, 'operator');
  db.prepare(`INSERT INTO users (id, name, operator_id, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'Marie Bernard', 'SUP001', 'm.bernard@renault.com', opHash, 'supervisor');

  const rtmaHash = bcrypt.hashSync('rtma123', 12);
  db.prepare(`INSERT INTO users (id, name, operator_id, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'RTMA Engineering', 'RTMA001', 'rtma@renault.com', rtmaHash, 'engineering');

  const rhlId = uuidv4();
  db.prepare(`INSERT INTO parking_lots (id, name, type, total_spots) VALUES (?, ?, ?, ?)`)
    .run(rhlId, 'Parking RHL', 'physical', 292);

  const contineId = uuidv4();
  db.prepare(`INSERT INTO parking_lots (id, name, type, total_spots) VALUES (?, ?, ?, ?)`)
    .run(contineId, 'Parking Contine', 'physical', 42);

  const blocks = {
    A: { total: 20, left: 10, right: 10 },
    B: { total: 30, left: 15, right: 15 },
    C: { total: 36, left: 18, right: 18 },
    D: { total: 36, left: 18, right: 18 },
    E: { total: 36, left: 18, right: 18 },
    F: { total: 36, left: 18, right: 18 },
    G: { total: 36, left: 18, right: 18 },
    H: { total: 36, left: 18, right: 18 },
    I: { total: 36, left: 18, right: 18 },
  };

  const carColors = ['#2D3436', '#E53935', '#1565C0', '#F5F5F5', '#424242', '#B71C1C', '#1A237E'];
  const vins = ['VF1RFE00X67123456', 'VF1KA0F09Z1234567', 'VF1BZ000458901234', 'VF1AB000012345678',
    'VF1DJ000567890123', 'VF1GNEF0A58234567', 'VF1HG000234567890', 'VF1JK000345678901'];
  const spotInsert = db.prepare(`INSERT INTO parking_spots (id, lot_id, spot_label, block, side, position, status, vin, occupied_at, car_color, operator_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const insertSpots = db.transaction(() => {
    Object.entries(blocks).forEach(([block, def]) => {
      for (let i = 1; i <= def.total; i++) {
        const label = `${block}${i}`;
        const side = i <= def.left ? 'left' : 'right';
        const rand = Math.random();
        let status = 'empty';
        if (rand < 0.42) status = 'occupied';
        else if (rand < 0.52) status = 'reserved';
        else if (rand < 0.55) status = 'alert';

        const vin = status !== 'empty' ? vins[Math.floor(Math.random() * vins.length)] : null;
        const color = carColors[Math.floor(Math.random() * carColors.length)];
        const occupiedAt = status !== 'empty'
          ? new Date(Date.now() - (status === 'alert' ? (6 + Math.random() * 5) : Math.random() * 5) * 86400000).toISOString()
          : null;

        spotInsert.run(uuidv4(), rhlId, label, block, side, i, status, vin, occupiedAt, color, status !== 'empty' ? 'OP001' : null);
      }
    });

    for (let i = 1; i <= 42; i++) {
      const label = `CT${i}`;
      const rand = Math.random();
      let status = 'empty';
      if (rand < 0.4) status = 'occupied';
      else if (rand < 0.48) status = 'reserved';

      const vin = status !== 'empty' ? vins[Math.floor(Math.random() * vins.length)] : null;
      const color = carColors[Math.floor(Math.random() * carColors.length)];
      const occupiedAt = status !== 'empty' ? new Date(Date.now() - Math.random() * 5 * 86400000).toISOString() : null;

      spotInsert.run(uuidv4(), contineId, label, null, null, i, status, vin, occupiedAt, color, status !== 'empty' ? 'OP001' : null);
    }
  });

  insertSpots();
  console.log('✅ Database seeded successfully');
}

seedDatabase();

module.exports = db;
