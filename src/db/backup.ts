import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export const BACKUP_APP = 'FareLedger';
export const BACKUP_VERSION = 1;

/** Parents first, so rows can be re-inserted with their original ids and foreign keys hold. */
const TABLES = [
  'buses',
  'drivers',
  'conductors',
  'ticket_prices',
  'expense_heads',
  'settings',
  'daily_entries',
  'entry_tickets',
  'entry_expenses',
] as const;

/** Lock settings belong to this phone (the PIN lives in its secure store), so they never travel in a backup. */
const DEVICE_ONLY_SETTINGS = ['app_lock', 'lock_biometric'];

type Row = Record<string, unknown>;
export type BackupFile = {
  app: string;
  version: number;
  exportedAt: string;
  tables: Record<(typeof TABLES)[number], Row[]>;
};

export async function buildBackup(db: SQLiteDatabase): Promise<BackupFile> {
  const tables = {} as BackupFile['tables'];
  for (const t of TABLES) {
    tables[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}`);
  }
  tables.settings = tables.settings.filter((r) => !DEVICE_ONLY_SETTINGS.includes(String(r.key)));
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

/** Writes the backup to a JSON file and opens the share sheet. Returns the entry count. */
export async function exportBackup(db: SQLiteDatabase): Promise<number> {
  const backup = await buildBackup(db);
  const file = new File(Paths.cache, `fareledger-backup-${stamp()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save FareLedger backup' });
  return backup.tables.daily_entries.length;
}

/** Throws a readable message if the parsed JSON is not a usable FareLedger backup. */
export function validateBackup(data: unknown): BackupFile {
  const d = data as Partial<BackupFile> | null;
  if (!d || typeof d !== 'object' || d.app !== BACKUP_APP) throw new Error('This is not a FareLedger backup file.');
  if (typeof d.version !== 'number' || d.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Please update the app first.');
  }
  if (!d.tables || typeof d.tables !== 'object') throw new Error('The backup file is missing its data.');
  for (const t of TABLES) {
    if (!Array.isArray(d.tables[t])) throw new Error(`The backup file is missing "${t}".`);
  }
  return d as BackupFile;
}

export type PickedBackup = { name: string; backup: BackupFile };

/** Lets the user choose a .json file and parses it. Returns null if they cancel. */
export async function pickBackup(): Promise<PickedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  let parsed: unknown;
  try {
    parsed = JSON.parse(await new File(asset.uri).text());
  } catch {
    throw new Error('That file could not be read as a backup.');
  }
  return { name: asset.name, backup: validateBackup(parsed) };
}

/** Replaces every table with the backup's rows in one transaction; nothing changes if it fails. */
export async function restoreBackup(db: SQLiteDatabase, backup: BackupFile) {
  await db.withTransactionAsync(async () => {
    const keep = (await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings')).filter((r) =>
      DEVICE_ONLY_SETTINGS.includes(r.key)
    );
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const cols = (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
      for (const row of backup.tables[t]) {
        const keys = Object.keys(row).filter((k) => cols.includes(k));
        if (!keys.length) continue;
        await db.runAsync(
          `INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
          keys.map((k) => row[k] as string | number | null)
        );
      }
    }
    // This phone's lock settings survive the restore, and a backup can't overwrite them.
    for (const r of keep) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [r.key, r.value]
      );
    }
    // Keep AUTOINCREMENT counters ahead of the restored ids.
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name IN ('daily_entries','entry_tickets','entry_expenses')");
  });
}

export const countEntries = (b: BackupFile) => b.tables.daily_entries.length;
