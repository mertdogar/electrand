import { z } from "zod"
import { observable } from "@trpc/server/observable"
import type Database from "better-sqlite3"
import type { Preferences } from "@shared/schemas"
import { getPreferences, setPreferences } from "@main/db"
import { router, publicProcedure, ee } from "../trpc"

export function createPreferencesRouter(db: Database.Database, defaults: Preferences) {
  return router({
    get: publicProcedure.query(() => {
      return getPreferences(db, defaults)
    }),

    set: publicProcedure
      .input(
        z.object({
          theme: z.enum(["dark", "light"]).optional(),
          fontSize: z.number().int().min(8).max(32).optional(),
          appMainDirectory: z.string().min(1).optional(),
        }),
      )
      .mutation(({ input }) => {
        const next = setPreferences(db, defaults, input)
        ee.emit("preferences:changed")
        return next
      }),

    onChange: publicProcedure.subscription(() => {
      return observable<string>((emit) => {
        const handler = () => emit.next("invalidate")
        ee.on("preferences:changed", handler)
        return () => {
          ee.off("preferences:changed", handler)
        }
      })
    }),
  })
}
