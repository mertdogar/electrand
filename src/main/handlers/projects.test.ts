import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  handleGetProjects,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
} from "./projects"

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "electrand-projects-test-"))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("handleGetProjects", () => {
  it("returns empty array when no projects", () => {
    expect(handleGetProjects(tmpDir)).toEqual([])
  })
})

describe("handleCreateProject", () => {
  it("creates and returns a project with generated id and timestamps", () => {
    const project = handleCreateProject(tmpDir, { name: "My App", path: "/home/user/app" })
    expect(project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(project.name).toBe("My App")
    expect(project.lastOpenedAt).toBeNull()
    // project.json was written to disk
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(tmpDir, project.id, "project.json"), "utf-8")
    )
    expect(onDisk.id).toBe(project.id)
  })

  it("rejects empty project name", () => {
    expect(() => handleCreateProject(tmpDir, { name: "", path: "/tmp" })).toThrow()
  })
})

describe("handleUpdateProject", () => {
  it("updates name and sets updatedAt", async () => {
    const created = handleCreateProject(tmpDir, { name: "Original", path: "/tmp" })
    await new Promise((r) => setTimeout(r, 5)) // ensure timestamp changes
    const updated = handleUpdateProject(tmpDir, { id: created.id, name: "Renamed" })
    expect(updated.name).toBe("Renamed")
    expect(updated.updatedAt > created.updatedAt).toBe(true)
  })

  it("throws if project does not exist", () => {
    expect(() =>
      handleUpdateProject(tmpDir, { id: "123e4567-e89b-12d3-a456-426614174000", name: "X" })
    ).toThrow("not found")
  })
})

describe("handleDeleteProject", () => {
  it("removes the project directory", () => {
    const project = handleCreateProject(tmpDir, { name: "ToDelete", path: "/tmp" })
    handleDeleteProject(tmpDir, { id: project.id })
    expect(fs.existsSync(path.join(tmpDir, project.id))).toBe(false)
  })
})
