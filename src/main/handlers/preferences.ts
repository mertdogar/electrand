import { ipcMain, BrowserWindow } from "electron"
import type Database from "better-sqlite3"
import { PreferencesSchema, type Preferences } from "@shared/schemas"
import { getPreferences, setPreferences } from "@main/db"

export function handleGetPreferences(
  db: Database.Database,
  defaults: Preferences
): Preferences {
  return getPreferences(db, defaults)
}

export function handleSetPreferences(
  db: Database.Database,
  defaults: Preferences,
  partial: unknown
): Preferences {
  const validated = PreferencesSchema.partial().parse(partial)
  const next = setPreferences(db, defaults, validated)
  broadcast("app:preferences:changed", next)
  return next
}

function broadcast(channel: string, data: unknown): void {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, data)
    }
  } catch {
    // Not running in Electron context (e.g., tests)
  }
}

export function registerPreferencesHandlers(
  db: Database.Database,
  defaults: Preferences
): void {
  ipcMain.handle("app:preferences:get", () =>
    handleGetPreferences(db, defaults)
  )
  ipcMain.handle("app:preferences:set", (_event, partial: unknown) =>
    handleSetPreferences(db, defaults, partial)
  )
}
