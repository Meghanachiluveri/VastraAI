import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_FILE_NAME = 'vastra.db';

// Determine database path relative to vastra-backend root
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../', DB_FILE_NAME);

// Ensure the directory for the database exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database connection
export const db: Database.Database = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

// Configure pragmas for performance and data integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Resolves the path to schema.sql in both development (src/) and production (dist/) environments.
 */
function getSchemaPath(): string {
  const possiblePaths = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'dist/db/schema.sql')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error('schema.sql could not be found in any expected location.');
}

/**
 * Initializes database schema idempotently without destroying existing data.
 */
export function initDatabase(): void {
  try {
    // Run safe migrations for product and order table columns FIRST so indexes succeed
    const columnsToEnsure = [
      'ALTER TABLE products ADD COLUMN subcategory TEXT DEFAULT "";',
      'ALTER TABLE products ADD COLUMN material TEXT DEFAULT "";',
      'ALTER TABLE products ADD COLUMN occasion TEXT DEFAULT "";',
      'ALTER TABLE products ADD COLUMN style_tags TEXT DEFAULT "[]";',
      'ALTER TABLE products ADD COLUMN is_new INTEGER DEFAULT 0;',
      'ALTER TABLE products ADD COLUMN is_archived INTEGER DEFAULT 0;',
      'ALTER TABLE products ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;',
      'ALTER TABLE orders ADD COLUMN customer_id TEXT;',
      'ALTER TABLE orders ADD COLUMN customer_name TEXT;',
      'ALTER TABLE orders ADD COLUMN customer_email TEXT;',
      'ALTER TABLE orders ADD COLUMN customer_phone TEXT;',
      'ALTER TABLE orders ADD COLUMN shipping_address TEXT;',
      'ALTER TABLE orders ADD COLUMN shipping_city TEXT;',
      'ALTER TABLE orders ADD COLUMN shipping_state TEXT;',
      'ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT;',
      'ALTER TABLE orders ADD COLUMN session_id TEXT;'
    ];

    for (const sql of columnsToEnsure) {
      try {
        db.exec(sql);
      } catch {
        // Table or column already exists/doesn't exist yet
      }
    }

    const schemaPath = getSchemaPath();
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);

    for (const sql of columnsToEnsure) {
      try {
        db.exec(sql);
      } catch {
        // Column already exists
      }
    }

    // Backfill session_id from audit_log if missing
    try {
      db.prepare(`
        UPDATE orders
        SET session_id = (
          SELECT session_id
          FROM audit_log
          WHERE audit_log.order_id = orders.id AND audit_log.session_id IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1
        )
        WHERE session_id IS NULL
      `).run();
    } catch {
      // ignore
    }

    // Ensure session index
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);');
    } catch {
      // ignore
    }

    // Seed default customer & address
    try {
      const { seedDefaultCustomer } = require('../services/customerAuthService');
      seedDefaultCustomer();
    } catch {
      // ignore in isolated tests
    }

    console.log(`[DB] Database initialized successfully at ${dbPath}`);
  } catch (error) {
    console.error('[DB] Failed to initialize database schema:', error);
    throw error;
  }
}

export default db;
