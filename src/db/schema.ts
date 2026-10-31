import type { SQLiteDatabase } from 'expo-sqlite';

const SCHEMA_V1 = `
CREATE TABLE buses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE conductors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ticket_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  value REAL NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE expense_heads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  type TEXT NOT NULL DEFAULT 'deduction' CHECK (type IN ('deduction','addition')),
  is_system INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE daily_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  bus_id INTEGER NOT NULL REFERENCES buses(id),
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  conductor_id INTEGER NOT NULL REFERENCES conductors(id),
  driver_pct REAL NOT NULL,
  conductor_pct REAL NOT NULL,
  gross REAL NOT NULL,
  total_expenses REAL NOT NULL,
  net REAL NOT NULL,
  driver_wage REAL NOT NULL,
  conductor_wage REAL NOT NULL,
  owner_cut REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (bus_id, entry_date)
);
CREATE INDEX idx_entries_date ON daily_entries(entry_date);
CREATE INDEX idx_entries_driver ON daily_entries(driver_id);
CREATE INDEX idx_entries_conductor ON daily_entries(conductor_id);
CREATE TABLE entry_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
  price REAL NOT NULL,
  issued INTEGER NOT NULL,
  returned INTEGER NOT NULL,
  sold INTEGER NOT NULL,
  amount REAL NOT NULL
);
CREATE INDEX idx_tickets_entry ON entry_tickets(entry_id);
CREATE TABLE entry_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
  head_id INTEGER REFERENCES expense_heads(id),
  head_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deduction','addition')),
  amount REAL NOT NULL,
  note TEXT
);
CREATE INDEX idx_expenses_entry ON entry_expenses(entry_id);
CREATE INDEX idx_expenses_head ON entry_expenses(head_id);

INSERT INTO settings (key, value) VALUES
  ('driver_pct', '15'),
  ('conductor_pct', '9'),
  ('default_issue_count', '100');
INSERT INTO ticket_prices (value) VALUES (10), (15), (18);
INSERT INTO expense_heads (name, type, is_system) VALUES
  ('Fine', 'deduction', 1),
  ('Spot Fine', 'deduction', 1),
  ('Return Tickets', 'deduction', 1);
INSERT INTO expense_heads (name, type, is_system) VALUES ('Diesel', 'deduction', 0);
`;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(SCHEMA_V1);
      await db.execAsync('PRAGMA user_version = 1;');
    });
  }
  if (version < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync('ALTER TABLE daily_entries ADD COLUMN entry_time TEXT;');
      await db.execAsync('PRAGMA user_version = 2;');
    });
  }
  if (version < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync('ALTER TABLE buses ADD COLUMN owner TEXT;');
      await db.execAsync('PRAGMA user_version = 3;');
    });
  }
}
