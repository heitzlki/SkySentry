import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { detectionObjects } from './schema';

// Create in-memory SQLite database using Bun's built-in SQLite
const sqlite = new Database(':memory:');
export const db = drizzle(sqlite, { schema: { detectionObjects } });

// Initialize the database schema
export function initializeDatabase() {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS detection_objects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camera_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      frame INTEGER,
      global_id INTEGER,
      label TEXT,
      x1 REAL,
      y1 REAL,
      x2 REAL,
      y2 REAL,
      cx REAL,
      cy REAL,
      Xc REAL,
      Yc REAL,
      Zc REAL,
      Xw REAL,
      Yw REAL,
      Zw REAL NOT NULL
    )
  `);

  console.log('✓ In-memory SQLite database initialized');
}

export { detectionObjects };
