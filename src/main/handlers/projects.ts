import { ipcMain, BrowserWindow } from "electron"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { ProjectSchema, type Project } from "@shared/schemas"
import { scanProjects, writeProject, deleteProjectDir, readProject } from "@main/projects"

const CreateInputSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
})

const UpdateInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
})

const DeleteInputSchema = z.object({ id: z.string().uuid() })

export function handleGetProjects(appMainDirectory: string): Project[] {
  return scanProjects(appMainDirectory)
}

export function handleCreateProject(
  appMainDirectory: string,
  input: unknown
): Project {
  const { name, path } = CreateInputSchema.parse(input)
  const now = new Date().toISOString()
  const project = ProjectSchema.parse({
    id: randomUUID(),
    name,
    path,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
  })
  writeProject(appMainDirectory, project)
  return project
}

export function handleUpdateProject(
  appMainDirectory: string,
  input: unknown
): Project {
  const { id, ...updates } = UpdateInputSchema.parse(input)
  const existing = readProject(appMainDirectory, id)
  if (!existing) throw new Error(`Project ${id} not found`)
  const updated = ProjectSchema.parse({
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  })
  writeProject(appMainDirectory, updated)
  return updated
}

export function handleDeleteProject(
  appMainDirectory: string,
  input: unknown
): void {
  const { id } = DeleteInputSchema.parse(input)
  deleteProjectDir(appMainDirectory, id)
}

function broadcastProjectsChanged(projects: Project[]): void {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("app:projects:changed", projects)
    }
  } catch {
    // Not in Electron context (e.g., tests)
  }
}

export function registerProjectsHandlers(
  getAppMainDirectory: () => string
): void {
  ipcMain.handle("app:projects:get", () =>
    handleGetProjects(getAppMainDirectory())
  )
  ipcMain.handle("app:projects:create", (_event, input: unknown) => {
    const project = handleCreateProject(getAppMainDirectory(), input)
    broadcastProjectsChanged(handleGetProjects(getAppMainDirectory()))
    return project
  })
  ipcMain.handle("app:projects:update", (_event, input: unknown) => {
    const project = handleUpdateProject(getAppMainDirectory(), input)
    broadcastProjectsChanged(handleGetProjects(getAppMainDirectory()))
    return project
  })
  ipcMain.handle("app:projects:delete", (_event, input: unknown) => {
    handleDeleteProject(getAppMainDirectory(), input)
    broadcastProjectsChanged(handleGetProjects(getAppMainDirectory()))
  })
}
