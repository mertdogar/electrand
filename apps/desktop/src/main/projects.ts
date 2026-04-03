import fs from "node:fs"
import path from "node:path"
import { ProjectSchema, type Project } from "@shared/schemas"

export function scanProjects(appMainDirectory: string): Project[] {
  const results: Project[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(appMainDirectory, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const jsonPath = path.join(appMainDirectory, entry.name, "project.json")
    if (!fs.existsSync(jsonPath)) continue
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
      const project = ProjectSchema.parse(raw)
      results.push(project)
    } catch (err) {
      console.warn(`[projects] Skipping invalid project.json in ${entry.name}:`, err)
    }
  }
  return results
}

export function writeProject(appMainDirectory: string, project: Project): void {
  const projectDir = path.join(appMainDirectory, project.id)
  fs.mkdirSync(projectDir, { recursive: true })
  fs.writeFileSync(path.join(projectDir, "project.json"), JSON.stringify(project, null, 2), "utf-8")
}

export function deleteProjectDir(appMainDirectory: string, id: string): void {
  const projectDir = path.join(appMainDirectory, id)
  fs.rmSync(projectDir, { recursive: true, force: true })
}

export function readProject(appMainDirectory: string, id: string): Project | null {
  const jsonPath = path.join(appMainDirectory, id, "project.json")
  if (!fs.existsSync(jsonPath)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
    return ProjectSchema.parse(raw)
  } catch {
    return null
  }
}
