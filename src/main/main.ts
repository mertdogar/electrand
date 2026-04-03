import { app, BrowserWindow } from "electron"
import path from "node:path"
import os from "node:os"
import fs from "node:fs"
import started from "electron-squirrel-startup"
import { createIPCHandler } from "electron-trpc-experimental/main"
import { openDb, cleanStaleAppState, initAppState, getPreferences, setPreferences } from "./db"
import { createAppRouter } from "./router"
import type { Preferences } from "@shared/schemas"

if (started) app.quit()

if (process.env.NODE_ENV === "development" || process.argv.includes("--dev")) {
  const port = process.env.DEBUG_PORT || "9333"
  app.commandLine.appendSwitch("remote-debugging-port", port)
  console.log(`Remote debugging enabled on port ${port}`)
}

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
    icon: path.join(__dirname, "../../resources/icon.png"),
    frame: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: "detach" })
  }
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
    setPreferences(db, defaults, defaults)
  }

  // 5. Ensure appMainDirectory exists
  fs.mkdirSync(preferences.appMainDirectory, { recursive: true })

  // 6. Register a fresh app_state row for this process
  initAppState(db, process.pid)

  // 7. Create the window
  const mainWindow = createWindow()

  // 8. Create tRPC router and attach IPC handler
  const getAppMainDirectory = () => getPreferences(db, defaults).appMainDirectory
  const appRouter = createAppRouter({ db, defaults, mainWindow, getAppMainDirectory })
  createIPCHandler({ router: appRouter, windows: [mainWindow] })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
