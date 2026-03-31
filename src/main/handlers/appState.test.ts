import { describe, it, expect, beforeEach } from "vitest"
import Database from "better-sqlite3"
import { runMigrations } from "@main/db"
import { handleGetAppState, handleSetAppState } from "./appState"

let db: Database.Database

beforeEach(() => {
  db = new Database(":memory:")
  runMigrations(db)
})

describe("handleGetAppState", () => {
  it("returns default state when nothing stored", () => {
    const result = handleGetAppState(db, 99999)
    expect(result).toEqual({ projectId: null })
  })
})

describe("handleSetAppState", () => {
  it("stores and returns updated app state", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    const result = handleSetAppState(db, 12345, { projectId: uuid })
    expect(result.projectId).toBe(uuid)
  })

  it("rejects invalid partial (throws ZodError)", () => {
    expect(() =>
      handleSetAppState(db, 12345, { projectId: "not-a-uuid" })
    ).toThrow()
  })

  it("sets projectId back to null", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    handleSetAppState(db, 12345, { projectId: uuid })
    const result = handleSetAppState(db, 12345, { projectId: null })
    expect(result.projectId).toBeNull()
  })
})
