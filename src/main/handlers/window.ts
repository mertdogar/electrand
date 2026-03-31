import { ipcMain, dialog, type BrowserWindow } from "electron"

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

  ipcMain.handle("app:dialog:select-directory", async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
