import { ipcMain } from "electron"
import type Database from "better-sqlite3"
import { AppStateSchema, type AppState } from "@shared/schemas"
import { getAppState, setAppState } from "@main/db"
import { readProject, writeProject } from "@main/projects"

export function handleGetAppState(
  db: Database.Database,
  pid: number
): AppState {
  return getAppState(db, pid)
}

export function handleSetAppState(
  db: Database.Database,
  pid: number,
  partial: unknown
): AppState {
  const validated = AppStateSchema.partial().parse(partial)
  return setAppState(db, pid, validated)
}

export function registerAppStateHandlers(
  db: Database.Database,
  getAppMainDirectory: () => string
): void {
  ipcMain.handle("app:appState:get", () =>
    handleGetAppState(db, process.pid)
  )
  ipcMain.handle("app:appState:set", (event, partial: unknown) => {
    const next = handleSetAppState(db, process.pid, partial)
    // Update lastOpenedAt when a project is opened
    if (next.projectId != null) {
      const appMainDirectory = getAppMainDirectory()
      const project = readProject(appMainDirectory, next.projectId)
      if (project) {
        writeProject(appMainDirectory, {
          ...project,
          lastOpenedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
    }
    // Send only to the requesting window — appState is per-process
    event.sender.send("app:appState:changed", next)
    return next
  })
}
