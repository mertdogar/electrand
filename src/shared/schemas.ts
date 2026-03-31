import { z } from "zod"

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  path: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime().nullable(),
})
export type Project = z.infer<typeof ProjectSchema>

export const PreferencesSchema = z.object({
  theme: z.enum(["dark", "light"]),
  fontSize: z.number().int().min(8).max(32),
  appMainDirectory: z.string().min(1),
})
export type Preferences = z.infer<typeof PreferencesSchema>

export const AppStateSchema = z.object({
  projectId: z.string().uuid().nullable(),
})
export type AppState = z.infer<typeof AppStateSchema>

export const AppInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  versions: z.object({
    electron: z.string().min(1),
    node: z.string().min(1),
    chrome: z.string().min(1),
  }),
})
export type AppInfo = z.infer<typeof AppInfoSchema>
