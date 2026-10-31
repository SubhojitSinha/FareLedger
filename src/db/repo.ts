import type { SQLiteDatabase } from 'expo-sqlite';
import { calculate, type ExpenseType } from '../domain/calc';
import type { ThemePref } from '../theme';

export type PersonKind = 'buses' | 'drivers' | 'conductors';
export type Person = { id: number; name: string; owner?: string | null };
export type Head = { id: number; name: string; type: ExpenseType; is_system: number; active: number };
export type Price = { id: number; value: number; active: number };
export type Rates = { driverPct: number; conductorPct: number; issueCount: number };

const nameCol = (kind: PersonKind) => (kind === 'buses' ? 'number' : 'name');

const pad = (n: number) => String(n).padStart(2, '0');
export const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const todayStr = () => dateStr(new Date());

/* ---------- settings ---------- */

export async function getRates(db: SQLiteDatabase): Promise<Rates> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const m = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
  return {
    driverPct: m.driver_pct ?? 15,
    conductorPct: m.conductor_pct ?? 9,
    issueCount: m.default_issue_count ?? 100,
  };
}

export async function saveRates(db: SQLiteDatabase, r: Rates) {
  await db.withTransactionAsync(async () => {
    const up = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
    await db.runAsync(up, ['driver_pct', String(r.driverPct)]);
    await db.runAsync(up, ['conductor_pct', String(r.conductorPct)]);
    await db.runAsync(up, ['default_issue_count', String(r.issueCount)]);
  });
}

export const listPrices = (db: SQLiteDatabase, activeOnly = false) =>
  db.getAllAsync<Price>(
    `SELECT id, value, active FROM ticket_prices ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY value`
  );

export const addPrice = (db: SQLiteDatabase, value: number) =>
  db.runAsync(
    'INSERT INTO ticket_prices (value) VALUES (?) ON CONFLICT(value) DO UPDATE SET active = 1',
    [value]
  );

export const setPriceActive = (db: SQLiteDatabase, id: number, active: boolean) =>
  db.runAsync('UPDATE ticket_prices SET active = ? WHERE id = ?', [active ? 1 : 0, id]);

export const listHeads = (db: SQLiteDatabase, activeOnly = false) =>
  db.getAllAsync<Head>(
    `SELECT id, name, type, is_system, active FROM expense_heads ${
      activeOnly ? 'WHERE active = 1' : ''
    } ORDER BY is_system DESC, name`
  );

export async function addHead(db: SQLiteDatabase, name: string): Promise<Head> {
  await db.runAsync(
    'INSERT INTO expense_heads (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET active = 1',
    [name]
  );
  const h = await db.getFirstAsync<Head>(
    'SELECT id, name, type, is_system, active FROM expense_heads WHERE name = ?',
    [name]
  );
  return h!;
}

export const setHeadActive = (db: SQLiteDatabase, id: number, active: boolean) =>
  db.runAsync('UPDATE expense_heads SET active = ? WHERE id = ? AND is_system = 0', [active ? 1 : 0, id]);

/* ---------- buses, drivers, conductors ---------- */

export const listPeople = (db: SQLiteDatabase, kind: PersonKind) =>
  db.getAllAsync<Person>(
    `SELECT id, ${nameCol(kind)} AS name${kind === 'buses' ? ', owner' : ''} FROM ${kind}
     WHERE active = 1 ORDER BY ${nameCol(kind)} COLLATE NOCASE`
  );

export async function addPerson(
  db: SQLiteDatabase,
  kind: PersonKind,
  name: string,
  owner?: string
): Promise<Person> {
  const col = nameCol(kind);
  if (kind === 'buses') {
    await db.runAsync(
      `INSERT INTO buses (number, owner) VALUES (?, ?)
       ON CONFLICT(number) DO UPDATE SET active = 1, owner = COALESCE(excluded.owner, buses.owner)`,
      [name, owner?.trim() || null]
    );
  } else {
    await db.runAsync(`INSERT INTO ${kind} (${col}) VALUES (?) ON CONFLICT(${col}) DO UPDATE SET active = 1`, [name]);
  }
  const p = await db.getFirstAsync<Person>(
    `SELECT id, ${col} AS name${kind === 'buses' ? ', owner' : ''} FROM ${kind} WHERE ${col} = ?`,
    [name]
  );
  return p!;
}

export type PersonRow = Person & { active: number; entries: number };

const PERSON_FK: Record<PersonKind, string> = {
  buses: 'bus_id',
  drivers: 'driver_id',
  conductors: 'conductor_id',
};

/** Every bus/driver/conductor, including hidden ones, with how many entries use it. */
export const listPeopleAll = (db: SQLiteDatabase, kind: PersonKind) =>
  db.getAllAsync<PersonRow>(
    `SELECT p.id, p.${nameCol(kind)} AS name${kind === 'buses' ? ', p.owner AS owner' : ''}, p.active,
            (SELECT COUNT(*) FROM daily_entries e WHERE e.${PERSON_FK[kind]} = p.id) AS entries
     FROM ${kind} p ORDER BY p.${nameCol(kind)} COLLATE NOCASE`
  );

export const updatePerson = (
  db: SQLiteDatabase,
  kind: PersonKind,
  id: number,
  name: string,
  active: boolean,
  owner?: string
) =>
  kind === 'buses'
    ? db.runAsync('UPDATE buses SET number = ?, owner = ?, active = ? WHERE id = ?', [
        name,
        owner?.trim() || null,
        active ? 1 : 0,
        id,
      ])
    : db.runAsync(`UPDATE ${kind} SET name = ?, active = ? WHERE id = ?`, [name, active ? 1 : 0, id]);

/* ---------- entries ---------- */

export type EntryInput = {
  date: string;
  time: string;
  busId: number;
  driverId: number;
  conductorId: number;
  driverPct: number;
  conductorPct: number;
  tickets: { price: number; issued: number; returned: number }[];
  expenses: { headId: number | null; headName: string; type: ExpenseType; amount: number; note: string }[];
};

export const DUPLICATE = 'DUPLICATE_ENTRY';

export async function saveEntry(db: SQLiteDatabase, input: EntryInput, id?: number): Promise<number> {
  const s = calculate(input.tickets, input.expenses, input.driverPct, input.conductorPct);
  let entryId = id ?? 0;
  await db.withTransactionAsync(async () => {
    const dup = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM daily_entries WHERE bus_id = ? AND entry_date = ? AND id != ?',
      [input.busId, input.date, id ?? 0]
    );
    if (dup) throw new Error(DUPLICATE);

    const vals = [
      input.date, input.time, input.busId, input.driverId, input.conductorId,
      input.driverPct, input.conductorPct,
      s.gross, s.totalExpenses, s.net, s.driver, s.conductor, s.owner,
    ];
    if (id) {
      await db.runAsync(
        `UPDATE daily_entries SET entry_date=?, entry_time=?, bus_id=?, driver_id=?, conductor_id=?, driver_pct=?, conductor_pct=?,
         gross=?, total_expenses=?, net=?, driver_wage=?, conductor_wage=?, owner_cut=?, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [...vals, id]
      );
      await db.runAsync('DELETE FROM entry_tickets WHERE entry_id = ?', [id]);
      await db.runAsync('DELETE FROM entry_expenses WHERE entry_id = ?', [id]);
    } else {
      const r = await db.runAsync(
        `INSERT INTO daily_entries (entry_date, entry_time, bus_id, driver_id, conductor_id, driver_pct, conductor_pct,
         gross, total_expenses, net, driver_wage, conductor_wage, owner_cut)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        vals
      );
      entryId = r.lastInsertRowId;
    }
    for (const t of s.tickets) {
      await db.runAsync(
        'INSERT INTO entry_tickets (entry_id, price, issued, returned, sold, amount) VALUES (?,?,?,?,?,?)',
        [entryId, t.price, t.issued, t.returned, t.sold, t.amount]
      );
    }
    for (const e of input.expenses) {
      await db.runAsync(
        'INSERT INTO entry_expenses (entry_id, head_id, head_name, type, amount, note) VALUES (?,?,?,?,?,?)',
        [entryId, e.headId, e.headName, e.type, e.amount, e.note || null]
      );
    }
  });
  return entryId;
}

export type EntrySummary = {
  id: number;
  entry_date: string;
  entry_time: string | null;
  bus: string;
  driver: string;
  conductor: string;
  gross: number;
  total_expenses: number;
  net: number;
  driver_wage: number;
  conductor_wage: number;
  owner_cut: number;
};

const ENTRY_SELECT = `
  SELECT e.id, e.entry_date, e.entry_time, b.number AS bus, d.name AS driver, c.name AS conductor,
         e.gross, e.total_expenses, e.net, e.driver_wage, e.conductor_wage, e.owner_cut
  FROM daily_entries e
  JOIN buses b ON b.id = e.bus_id
  JOIN drivers d ON d.id = e.driver_id
  JOIN conductors c ON c.id = e.conductor_id`;

export const listEntries = (db: SQLiteDatabase, limit = 100) =>
  db.getAllAsync<EntrySummary>(`${ENTRY_SELECT} ORDER BY e.entry_date DESC, e.entry_time DESC, e.id DESC LIMIT ?`, [limit]);

export const listEntriesOn = (db: SQLiteDatabase, date: string) =>
  db.getAllAsync<EntrySummary>(`${ENTRY_SELECT} WHERE e.entry_date = ? ORDER BY e.entry_time DESC, e.id DESC`, [date]);

/** True if the bus already has an entry on that date (ignoring the entry being edited). */
export async function entryExists(db: SQLiteDatabase, busId: number, date: string, excludeId?: number) {
  const r = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM daily_entries WHERE bus_id = ? AND entry_date = ? AND id != ?',
    [busId, date, excludeId ?? 0]
  );
  return !!r;
}

export type EntryDetail = {
  id: number;
  entry_date: string;
  entry_time: string | null;
  bus_id: number;
  driver_id: number;
  conductor_id: number;
  bus: string;
  driver: string;
  conductor: string;
  driver_pct: number;
  conductor_pct: number;
  tickets: { price: number; issued: number; returned: number }[];
  expenses: { head_id: number | null; head_name: string; type: ExpenseType; amount: number; note: string | null }[];
};

export async function getEntry(db: SQLiteDatabase, id: number): Promise<EntryDetail | null> {
  const e = await db.getFirstAsync<Omit<EntryDetail, 'tickets' | 'expenses'>>(
    `SELECT e.id, e.entry_date, e.entry_time, e.bus_id, e.driver_id, e.conductor_id, e.driver_pct, e.conductor_pct,
            b.number AS bus, d.name AS driver, c.name AS conductor
     FROM daily_entries e
     JOIN buses b ON b.id = e.bus_id
     JOIN drivers d ON d.id = e.driver_id
     JOIN conductors c ON c.id = e.conductor_id
     WHERE e.id = ?`,
    [id]
  );
  if (!e) return null;
  const tickets = await db.getAllAsync<EntryDetail['tickets'][number]>(
    'SELECT price, issued, returned FROM entry_tickets WHERE entry_id = ? ORDER BY price',
    [id]
  );
  const expenses = await db.getAllAsync<EntryDetail['expenses'][number]>(
    'SELECT head_id, head_name, type, amount, note FROM entry_expenses WHERE entry_id = ? ORDER BY id',
    [id]
  );
  return { ...e, tickets, expenses };
}

export const deleteEntry = (db: SQLiteDatabase, id: number) =>
  db.runAsync('DELETE FROM daily_entries WHERE id = ?', [id]);

/* ---------- reports ---------- */

export type Totals = {
  entries: number;
  gross: number;
  expenses: number;
  net: number;
  driver: number;
  conductor: number;
  owner: number;
};

export async function getTotals(db: SQLiteDatabase, from: string, to: string): Promise<Totals> {
  const r = await db.getFirstAsync<Totals>(
    `SELECT COUNT(*) AS entries,
            COALESCE(SUM(gross),0) AS gross, COALESCE(SUM(total_expenses),0) AS expenses,
            COALESCE(SUM(net),0) AS net, COALESCE(SUM(driver_wage),0) AS driver,
            COALESCE(SUM(conductor_wage),0) AS conductor, COALESCE(SUM(owner_cut),0) AS owner
     FROM daily_entries WHERE entry_date BETWEEN ? AND ?`,
    [from, to]
  );
  return r!;
}

export const getByBus = (db: SQLiteDatabase, from: string, to: string) =>
  db.getAllAsync<{ name: string; days: number; net: number; owner: number }>(
    `SELECT b.number AS name, COUNT(*) AS days, SUM(e.net) AS net, SUM(e.owner_cut) AS owner
     FROM daily_entries e JOIN buses b ON b.id = e.bus_id
     WHERE e.entry_date BETWEEN ? AND ? GROUP BY e.bus_id ORDER BY net DESC`,
    [from, to]
  );

export const getByPerson = (db: SQLiteDatabase, kind: 'drivers' | 'conductors', from: string, to: string) => {
  const fk = kind === 'drivers' ? 'driver_id' : 'conductor_id';
  const wage = kind === 'drivers' ? 'driver_wage' : 'conductor_wage';
  return db.getAllAsync<{ name: string; days: number; wages: number }>(
    `SELECT p.name AS name, COUNT(*) AS days, SUM(e.${wage}) AS wages
     FROM daily_entries e JOIN ${kind} p ON p.id = e.${fk}
     WHERE e.entry_date BETWEEN ? AND ? GROUP BY e.${fk} ORDER BY wages DESC`,
    [from, to]
  );
};

export const getByHead = (db: SQLiteDatabase, from: string, to: string) =>
  db.getAllAsync<{ name: string; type: ExpenseType; total: number }>(
    `SELECT x.head_name AS name, x.type AS type, SUM(x.amount) AS total
     FROM entry_expenses x JOIN daily_entries e ON e.id = x.entry_id
     WHERE e.entry_date BETWEEN ? AND ? GROUP BY x.head_name, x.type ORDER BY total DESC`,
    [from, to]
  );

/* ---------- appearance ---------- */

export async function getThemePref(db: SQLiteDatabase): Promise<ThemePref> {
  const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'theme'");
  return r?.value === 'light' || r?.value === 'dark' ? r.value : 'system';
}

export const saveThemePref = (db: SQLiteDatabase, pref: ThemePref) =>
  db.runAsync(
    "INSERT INTO settings (key, value) VALUES ('theme', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [pref]
  );

/* ---------- statements (bus / driver / conductor reports) ---------- */

export type StatementKind = 'bus' | 'driver' | 'conductor';

export type StatementRow = {
  id: number;
  entry_date: string;
  entry_time: string | null;
  bus: string;
  driver: string;
  conductor: string;
  gross: number;
  total_expenses: number;
  net: number;
  driver_pct: number;
  conductor_pct: number;
  driver_wage: number;
  conductor_wage: number;
  owner_cut: number;
};

const STATEMENT_FK: Record<StatementKind, string> = {
  bus: 'e.bus_id',
  driver: 'e.driver_id',
  conductor: 'e.conductor_id',
};

export const getStatement = (db: SQLiteDatabase, kind: StatementKind, id: number, from: string, to: string) =>
  db.getAllAsync<StatementRow>(
    `SELECT e.id, e.entry_date, e.entry_time, b.number AS bus, d.name AS driver, c.name AS conductor,
            e.gross, e.total_expenses, e.net, e.driver_pct, e.conductor_pct,
            e.driver_wage, e.conductor_wage, e.owner_cut
     FROM daily_entries e
     JOIN buses b ON b.id = e.bus_id
     JOIN drivers d ON d.id = e.driver_id
     JOIN conductors c ON c.id = e.conductor_id
     WHERE ${STATEMENT_FK[kind]} = ? AND e.entry_date BETWEEN ? AND ?
     ORDER BY e.entry_date, e.entry_time, e.id`,
    [id, from, to]
  );

/* ---------- generic settings ---------- */

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return r?.value ?? null;
}

export const setSetting = (db: SQLiteDatabase, key: string, value: string) =>
  db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
