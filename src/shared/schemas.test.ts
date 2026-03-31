import { describe, it, expect } from "vitest"
import {
  ProjectSchema,
  PreferencesSchema,
  AppStateSchema,
  AppInfoSchema,
} from "./schemas"

describe("ProjectSchema", () => {
  it("parses a valid project", () => {
    const input = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "My Project",
      path: "/home/user/projects/my-project",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastOpenedAt: null,
    }
    expect(() => ProjectSchema.parse(input)).not.toThrow()
  })

  it("rejects empty name", () => {
    expect(() =>
      ProjectSchema.parse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "",
        path: "/some/path",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastOpenedAt: null,
      })
    ).toThrow()
  })

  it("rejects invalid uuid", () => {
    expect(() =>
      ProjectSchema.parse({
        id: "not-a-uuid",
        name: "Project",
        path: "/some/path",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastOpenedAt: null,
      })
    ).toThrow()
  })
})

describe("PreferencesSchema", () => {
  it("parses valid preferences", () => {
    const input = { theme: "dark", fontSize: 14, appMainDirectory: "/home/user/.local/myapp" }
    expect(() => PreferencesSchema.parse(input)).not.toThrow()
  })

  it("rejects invalid theme", () => {
    expect(() =>
      PreferencesSchema.parse({ theme: "blue", fontSize: 14, appMainDirectory: "/tmp" })
    ).toThrow()
  })

  it("rejects fontSize out of range", () => {
    expect(() =>
      PreferencesSchema.parse({ theme: "dark", fontSize: 5, appMainDirectory: "/tmp" })
    ).toThrow()
  })
})

describe("AppInfoSchema", () => {
  it("parses valid app info", () => {
    expect(() =>
      AppInfoSchema.parse({
        name: "electrand",
        version: "1.0.0",
        versions: { electron: "41.1.0", node: "20.0.0", chrome: "120.0.0" },
      })
    ).not.toThrow()
  })

  it("rejects empty name", () => {
    expect(() =>
      AppInfoSchema.parse({
        name: "",
        version: "1.0.0",
        versions: { electron: "41.1.0", node: "20.0.0", chrome: "120.0.0" },
      })
    ).toThrow()
  })
})

describe("AppStateSchema", () => {
  it("accepts null projectId", () => {
    expect(() => AppStateSchema.parse({ projectId: null })).not.toThrow()
  })

  it("accepts valid uuid projectId", () => {
    expect(() =>
      AppStateSchema.parse({ projectId: "123e4567-e89b-12d3-a456-426614174000" })
    ).not.toThrow()
  })

  it("rejects non-uuid string", () => {
    expect(() => AppStateSchema.parse({ projectId: "not-a-uuid" })).toThrow()
  })
})
