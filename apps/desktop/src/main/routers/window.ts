import { dialog, type BrowserWindow } from "electron"
import { router, publicProcedure } from "../trpc"

export function createWindowRouter(window: BrowserWindow) {
  return router({
    minimize: publicProcedure.mutation(() => {
      window.minimize()
    }),

    maximizeToggle: publicProcedure.mutation(() => {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }),

    close: publicProcedure.mutation(() => {
      window.close()
    }),

    selectDirectory: publicProcedure.mutation(async () => {
      const result = await dialog.showOpenDialog(window, {
        properties: ["openDirectory", "createDirectory"],
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }),
  })
}
