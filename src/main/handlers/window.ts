import { ipcMain, type BrowserWindow } from "electron"

export function registerWindowHandlers(window: BrowserWindow): void {
  ipcMain.handle("app:window:minimize", () => {
    window.minimize()
  })

  ipcMain.handle("app:window:maximize-toggle", () => {
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  ipcMain.handle("app:window:close", () => {
    window.close()
  })
}
