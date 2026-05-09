'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  return db.runSql(`
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
};

exports.down = function(db) {
  return db.runSql(`
    DROP TABLE IF EXISTS system_settings;
    DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS alerts;
    DROP TABLE IF EXISTS vehicle_history;
    DROP TABLE IF EXISTS vehicles;
    DROP TABLE IF EXISTS parking_spots;
    DROP TABLE IF EXISTS parking_lots;
    DROP TABLE IF EXISTS invite_codes;
    DROP TABLE IF EXISTS users;
  `);
};

exports._meta = {
  "version": 1
};
