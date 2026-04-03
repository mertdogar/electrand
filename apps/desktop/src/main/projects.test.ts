import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { scanProjects, writeProject, deleteProjectDir } from "./projects"
import type { Project } from "@shared/schemas"

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Project",
    path: "/home/user/test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: null,
    ...overrides,
  }
}

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "electrand-test-"))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("scanProjects", () => {
  it("returns empty array when directory is empty", () => {
    expect(scanProjects(tmpDir)).toEqual([])
  })

  it("returns projects from valid project.json files", () => {
    const project = makeProject()
    const projectDir = path.join(tmpDir, project.id)
    fs.mkdirSync(projectDir)
    fs.writeFileSync(path.join(projectDir, "project.json"), JSON.stringify(project))
    const result = scanProjects(tmpDir)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(project.id)
  })

  it("skips directories without project.json", () => {
    fs.mkdirSync(path.join(tmpDir, "not-a-project"))
    expect(scanProjects(tmpDir)).toEqual([])
  })

  it("skips invalid project.json (logs, no crash)", () => {
    const dir = path.join(tmpDir, "bad-project")
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify({ invalid: true }))
    expect(scanProjects(tmpDir)).toEqual([])
  })
})

describe("writeProject", () => {
  it("creates project directory and writes project.json", () => {
    const project = makeProject()
    writeProject(tmpDir, project)
    const written = JSON.parse(
      fs.readFileSync(path.join(tmpDir, project.id, "project.json"), "utf-8"),
    )
    expect(written.id).toBe(project.id)
  })

  it("overwrites existing project.json on update", () => {
    const project = makeProject()
    writeProject(tmpDir, project)
    const updated = { ...project, name: "Updated" }
    writeProject(tmpDir, updated)
    const written = JSON.parse(
      fs.readFileSync(path.join(tmpDir, project.id, "project.json"), "utf-8"),
    )
    expect(written.name).toBe("Updated")
  })
})

describe("deleteProjectDir", () => {
  it("removes the project directory", () => {
    const project = makeProject()
    writeProject(tmpDir, project)
    deleteProjectDir(tmpDir, project.id)
    expect(fs.existsSync(path.join(tmpDir, project.id))).toBe(false)
  })

  it("does not throw if directory does not exist", () => {
    expect(() => deleteProjectDir(tmpDir, "non-existent-id")).not.toThrow()
  })
})
