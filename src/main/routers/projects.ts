import { z } from "zod"
import { observable } from "@trpc/server/observable"
import { randomUUID } from "node:crypto"
import { ProjectSchema } from "@shared/schemas"
import { scanProjects, writeProject, deleteProjectDir, readProject } from "@main/projects"
import { router, publicProcedure, ee } from "../trpc"

export function createProjectsRouter(getAppMainDirectory: () => string) {
  return router({
    list: publicProcedure.query(() => {
      return scanProjects(getAppMainDirectory())
    }),

    create: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          path: z.string().min(1),
        }),
      )
      .mutation(({ input }) => {
        const now = new Date().toISOString()
        const project = ProjectSchema.parse({
          id: randomUUID(),
          name: input.name,
          path: input.path,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: null,
        })
        writeProject(getAppMainDirectory(), project)
        ee.emit("projects:changed")
        return project
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          path: z.string().min(1).optional(),
        }),
      )
      .mutation(({ input }) => {
        const { id, ...updates } = input
        const existing = readProject(getAppMainDirectory(), id)
        if (!existing) throw new Error(`Project ${id} not found`)
        const updated = ProjectSchema.parse({
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
        })
        writeProject(getAppMainDirectory(), updated)
        ee.emit("projects:changed")
        return updated
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) => {
        deleteProjectDir(getAppMainDirectory(), input.id)
        ee.emit("projects:changed")
      }),

    onChange: publicProcedure.subscription(() => {
      return observable<string>((emit) => {
        const handler = () => emit.next("invalidate")
        ee.on("projects:changed", handler)
        return () => {
          ee.off("projects:changed", handler)
        }
      })
    }),
  })
}
