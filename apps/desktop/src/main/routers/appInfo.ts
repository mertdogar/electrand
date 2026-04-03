import { app } from "electron"
import { AppInfoSchema } from "@shared/schemas"
import { router, publicProcedure } from "../trpc"

export function createAppInfoRouter() {
  return router({
    get: publicProcedure.query(() => {
      return AppInfoSchema.parse({
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
        versions: {
          electron: process.versions.electron,
          node: process.versions.node,
          chrome: process.versions.chrome,
        },
      })
    }),
  })
}
