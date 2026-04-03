import Database from "better-sqlite3"
import { PreferencesSchema, AppStateSchema, type Preferences, type AppState } from "@shared/schemas"

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      id   INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (
      pid  INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    );
  `)
}

export function getPreferences(db: Database.Database, defaults: Preferences): Preferences {
  const row = db.prepare("SELECT data FROM preferences WHERE id = 1").get() as
    | { data: string }
    | undefined
  if (!row) return defaults
  return PreferencesSchema.parse(JSON.parse(row.data))
}

export function setPreferences(
  db: Database.Database,
  defaults: Preferences,
  partial: Partial<Preferences>,
): Preferences {
  const current = getPreferences(db, defaults)
  const next = PreferencesSchema.parse({ ...current, ...partial })
  db.prepare(
    "INSERT INTO preferences (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
  ).run(JSON.stringify(next))
  return next
}

export function getAppState(db: Database.Database, pid: number): AppState {
  const row = db.prepare("SELECT data FROM app_state WHERE pid = ?").get(pid) as
    | { data: string }
    | undefined
  if (!row) return { projectId: null }
  return AppStateSchema.parse(JSON.parse(row.data))
}

export function setAppState(
  db: Database.Database,
  pid: number,
  partial: Partial<AppState>,
): AppState {
  const current = getAppState(db, pid)
  const next = AppStateSchema.parse({ ...current, ...partial })
  db.prepare(
    "INSERT INTO app_state (pid, data) VALUES (?, ?) ON CONFLICT(pid) DO UPDATE SET data = excluded.data",
  ).run(pid, JSON.stringify(next))
  return next
}

export function initAppState(db: Database.Database, pid: number): AppState {
  const state: AppState = { projectId: null }
  db.prepare(
    "INSERT INTO app_state (pid, data) VALUES (?, ?) ON CONFLICT(pid) DO UPDATE SET data = excluded.data",
  ).run(pid, JSON.stringify(state))
  return state
}

export function cleanStaleAppState(db: Database.Database): void {
  const rows = db.prepare("SELECT pid FROM app_state").all() as { pid: number }[]
  for (const { pid } of rows) {
    try {
      process.kill(pid, 0)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ESRCH") {
        db.prepare("DELETE FROM app_state WHERE pid = ?").run(pid)
      }
      // EPERM means the process exists but is not owned by us — leave the row
    }
  }
}

export function openDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  runMigrations(db)
  return db
}
