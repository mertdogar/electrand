import { describe, it, expect, beforeEach } from "vitest"
import Database from "better-sqlite3"
import {
  runMigrations,
  cleanStaleAppState,
  getPreferences,
  setPreferences,
  getAppState,
  setAppState,
  initAppState,
} from "./db"
import type { Preferences } from "@shared/schemas"

const DEFAULT_PREFS: Preferences = {
  theme: "dark",
  fontSize: 14,
  appMainDirectory: "/tmp/test-app",
}

function makeDb(): Database.Database {
  const db = new Database(":memory:")
  runMigrations(db)
  return db
}

describe("preferences", () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it("returns defaults when no row exists", () => {
    const prefs = getPreferences(db, DEFAULT_PREFS)
    expect(prefs).toEqual(DEFAULT_PREFS)
  })

  it("persists and returns preferences", () => {
    setPreferences(db, DEFAULT_PREFS, { theme: "light" })
    const prefs = getPreferences(db, DEFAULT_PREFS)
    expect(prefs.theme).toBe("light")
    expect(prefs.fontSize).toBe(14)
  })

  it("merges partial update", () => {
    setPreferences(db, DEFAULT_PREFS, { fontSize: 18 })
    const prefs = getPreferences(db, DEFAULT_PREFS)
    expect(prefs.fontSize).toBe(18)
    expect(prefs.theme).toBe("dark")
  })
})

describe("appState", () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it("returns default state when no row exists", () => {
    const state = getAppState(db, 99999)
    expect(state).toEqual({ projectId: null })
  })

  it("persists app state for a pid", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    setAppState(db, 12345, { projectId: uuid })
    const state = getAppState(db, 12345)
    expect(state.projectId).toBe(uuid)
  })

  it("isolates state between pids", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    setAppState(db, 111, { projectId: uuid })
    const state = getAppState(db, 222)
    expect(state.projectId).toBeNull()
  })
})

describe("initAppState", () => {
  it("resets existing non-null state to null", () => {
    const db = makeDb()
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    setAppState(db, 12345, { projectId: uuid })
    initAppState(db, 12345)
    expect(getAppState(db, 12345).projectId).toBeNull()
  })
})

describe("cleanStaleAppState", () => {
  it("removes rows for non-existent pids", () => {
    const db = makeDb()
    // Insert a row with a pid that definitely doesn't exist (pid 1 is init on Linux, use a huge number)
    db.prepare("INSERT INTO app_state (pid, data) VALUES (?, ?)").run(
      999999999,
      JSON.stringify({ projectId: null })
    )
    cleanStaleAppState(db)
    const row = db.prepare("SELECT * FROM app_state WHERE pid = ?").get(999999999)
    expect(row).toBeUndefined()
  })
})
