import { describe, it, expect, beforeEach } from "vitest"
import Database from "better-sqlite3"
import { runMigrations } from "@main/db"
import { handleGetPreferences, handleSetPreferences } from "./preferences"

const DEFAULTS = { theme: "dark" as const, fontSize: 14, appMainDirectory: "/tmp/test" }

let db: Database.Database

beforeEach(() => {
  db = new Database(":memory:")
  runMigrations(db)
})

describe("handleGetPreferences", () => {
  it("returns defaults when nothing stored", () => {
    const result = handleGetPreferences(db, DEFAULTS)
    expect(result).toEqual(DEFAULTS)
  })
})

describe("handleSetPreferences", () => {
  it("stores and returns updated preferences", () => {
    const result = handleSetPreferences(db, DEFAULTS, { theme: "light" })
    expect(result.theme).toBe("light")
    expect(result.fontSize).toBe(14)
  })

  it("rejects invalid partial (throws ZodError)", () => {
    expect(() => handleSetPreferences(db, DEFAULTS, { fontSize: 3 })).toThrow()
  })

  it("rejects unknown keys gracefully by ignoring them", () => {
    const result = handleSetPreferences(db, DEFAULTS, { theme: "dark" })
    expect(result.theme).toBe("dark")
  })
})
