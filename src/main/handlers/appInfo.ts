import { ipcMain, app } from "electron"
import { AppInfoSchema, type AppInfo } from "@shared/schemas"

export function getAppInfo(): AppInfo {
  return AppInfoSchema.parse({
    name: app.getName(),
    version: app.getVersion(),
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
    },
  })
}

export function registerAppInfoHandlers(): void {
  ipcMain.handle("app:info:get", () => getAppInfo())
}
