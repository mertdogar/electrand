import { z } from "zod"
import { observable } from "@trpc/server/observable"
import type Database from "better-sqlite3"
import { getAppState, setAppState } from "@main/db"
import { readProject, writeProject } from "@main/projects"
import { router, publicProcedure, ee } from "../trpc"

export function createAppStateRouter(db: Database.Database, getAppMainDirectory: () => string) {
  return router({
    get: publicProcedure.query(() => {
      return getAppState(db, process.pid)
    }),

    set: publicProcedure
      .input(
        z.object({
          projectId: z.string().uuid().nullable().optional(),
        }),
      )
      .mutation(({ input }) => {
        const next = setAppState(db, process.pid, input)
        if (next.projectId != null) {
          const appMainDirectory = getAppMainDirectory()
          const project = readProject(appMainDirectory, next.projectId)
          if (project) {
            writeProject(appMainDirectory, {
              ...project,
              lastOpenedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }
        }
        ee.emit("appState:changed")
        return next
      }),

    onChange: publicProcedure.subscription(() => {
      return observable<string>((emit) => {
        const handler = () => emit.next("invalidate")
        ee.on("appState:changed", handler)
        return () => {
          ee.off("appState:changed", handler)
        }
      })
    }),
  })
}
