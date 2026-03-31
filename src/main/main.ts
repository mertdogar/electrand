import { app, BrowserWindow } from "electron"
import path from "node:path"
import os from "node:os"
import fs from "node:fs"
import started from "electron-squirrel-startup"
import { openDb, cleanStaleAppState, initAppState, getPreferences, setPreferences } from "./db"
import { registerPreferencesHandlers } from "./handlers/preferences"
import { registerProjectsHandlers } from "./handlers/projects"
import { registerAppStateHandlers } from "./handlers/appState"
import { registerAppInfoHandlers } from "./handlers/appInfo"
import type { Preferences } from "@shared/schemas"

if (started) app.quit()

function resolveDefaultPreferences(): Preferences {
  return {
    theme: "dark",
    fontSize: 14,
    appMainDirectory: path.join(os.homedir(), ".local", app.getName()),
  }
}

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    )
  }

  mainWindow.webContents.openDevTools()
  return mainWindow
}

app.on("ready", () => {
  // 1. Resolve bootstrap directory
  const bootstrapDir = path.join(os.homedir(), ".local", app.getName())
  fs.mkdirSync(bootstrapDir, { recursive: true })

  // 2. Open SQLite database
  const db = openDb(path.join(bootstrapDir, "app.db"))

  // 3. Clean stale app_state rows from previous crashed processes
  cleanStaleAppState(db)

  // 4. Load preferences (or write defaults)
  const defaults = resolveDefaultPreferences()
  const preferences = getPreferences(db, defaults)
  if (preferences === defaults) {
    // First launch — persist defaults
    setPreferences(db, defaults, defaults)
  }

  // 5. Ensure appMainDirectory exists
  fs.mkdirSync(preferences.appMainDirectory, { recursive: true })

  // 6. Register a fresh app_state row for this process
  initAppState(db, process.pid)

  // 7. Register all IPC handlers
  registerPreferencesHandlers(db, defaults)
  registerProjectsHandlers(() => getPreferences(db, defaults).appMainDirectory)
  registerAppStateHandlers(db)
  registerAppInfoHandlers()

  // 8. Create the window
  createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
