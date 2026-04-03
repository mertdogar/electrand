import type Database from "better-sqlite3"
import type { BrowserWindow } from "electron"
import type { Preferences } from "@shared/schemas"
import { router } from "./trpc"
import { createPreferencesRouter } from "./routers/preferences"
import { createProjectsRouter } from "./routers/projects"
import { createAppStateRouter } from "./routers/appState"
import { createAppInfoRouter } from "./routers/appInfo"
import { createWindowRouter } from "./routers/window"

export function createAppRouter(deps: {
  db: Database.Database
  defaults: Preferences
  mainWindow: BrowserWindow
  getAppMainDirectory: () => string
}) {
  return router({
    preferences: createPreferencesRouter(deps.db, deps.defaults),
    projects: createProjectsRouter(deps.getAppMainDirectory),
    appState: createAppStateRouter(deps.db, deps.getAppMainDirectory),
    appInfo: createAppInfoRouter(),
    window: createWindowRouter(deps.mainWindow),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>
