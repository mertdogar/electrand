# electron-trpc Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled IPC layer with electron-trpc-experimental, giving the app end-to-end type-safe RPC between main and renderer using tRPC v11.

**Architecture:** A tRPC router in the main process with 5 nested sub-routers (preferences, projects, appState, appInfo, window). Each sub-router is created via a factory function receiving its dependencies. The renderer uses `@trpc/react-query` with `ipcLink` — no manual type interfaces. Subscriptions push invalidation signals; the renderer refetches via tRPC queries.

**Tech Stack:** electron-trpc-experimental 1.0.0-alpha.1, @trpc/server@^11, @trpc/client@^11, @trpc/react-query@^11, Zod (existing), React Query (existing), Electron 41.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/main/trpc.ts` | tRPC init, shared EventEmitter, exported `router` and `publicProcedure` |
| Create | `src/main/routers/preferences.ts` | Preferences sub-router (get, set, onChange) |
| Create | `src/main/routers/projects.ts` | Projects sub-router (list, create, update, delete, onChange) |
| Create | `src/main/routers/appState.ts` | AppState sub-router (get, set, onChange) |
| Create | `src/main/routers/appInfo.ts` | AppInfo sub-router (get) |
| Create | `src/main/routers/window.ts` | Window sub-router (minimize, maximizeToggle, close, selectDirectory) |
| Create | `src/main/router.ts` | Merged appRouter + exported `AppRouter` type |
| Create | `src/renderer/trpc.ts` | `createTRPCReact<AppRouter>()` + `createTRPCClient()` |
| Modify | `src/renderer/preload.ts` | Replace hand-rolled bridge with `exposeElectronTRPC()` |
| Modify | `src/main/main.ts` | Replace handler registration with `createIPCHandler` |
| Modify | `src/renderer/App.tsx` | Add `trpc.Provider` wrapping |
| Modify | `src/renderer/routes/__root.tsx` | Replace `useIpcInvalidation` with tRPC subscription hooks |
| Modify | `src/renderer/components/titlebar.tsx` | Replace old hooks with tRPC calls |
| Modify | `src/renderer/components/sidebar/project-sidebar.tsx` | Replace old hooks with tRPC calls |
| Modify | `src/renderer/components/command-palette.tsx` | Replace old hooks with tRPC calls |
| Modify | `src/renderer/routes/index.tsx` | Replace old hooks with tRPC calls |
| Modify | `src/renderer/routes/about.tsx` | Replace old hooks with tRPC calls |
| Modify | `src/renderer/routes/preferences.tsx` | Replace old hooks with tRPC calls |
| Modify | `src/renderer/routes/projects/$projectId/route.tsx` | Replace old hooks with tRPC calls |
| Modify | `src/renderer/routes/projects/$projectId/index.tsx` | Replace old hooks with tRPC calls |
| Modify | `src/renderer/routes/projects/$projectId/settings.tsx` | Replace old hooks with tRPC calls |
| Delete | `src/renderer/bridge.ts` | Replaced by tRPC type inference |
| Delete | `src/renderer/hooks/use-projects.ts` | Replaced by `trpc.projects.*` |
| Delete | `src/renderer/hooks/use-preferences.ts` | Replaced by `trpc.preferences.*` |
| Delete | `src/renderer/hooks/use-app-state.ts` | Replaced by `trpc.appState.*` |
| Delete | `src/renderer/hooks/use-app-info.ts` | Replaced by `trpc.appInfo.*` |
| Delete | `src/renderer/hooks/use-window-controls.ts` | Replaced by `trpc.window.*` |
| Delete | `src/renderer/hooks/use-ipc-invalidation.ts` | Replaced by tRPC subscriptions in `__root.tsx` |
| Delete | `src/main/handlers/preferences.ts` | Replaced by `src/main/routers/preferences.ts` |
| Delete | `src/main/handlers/projects.ts` | Replaced by `src/main/routers/projects.ts` |
| Delete | `src/main/handlers/appState.ts` | Replaced by `src/main/routers/appState.ts` |
| Delete | `src/main/handlers/appInfo.ts` | Replaced by `src/main/routers/appInfo.ts` |
| Delete | `src/main/handlers/window.ts` | Replaced by `src/main/routers/window.ts` |

**Preserved (unchanged):**
- `src/main/db.ts` — SQLite operations
- `src/main/projects.ts` — Filesystem operations
- `src/shared/schemas.ts` — Zod schemas

---

### Task 1: Install tRPC dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @trpc/server, @trpc/client, @trpc/react-query**

```bash
npm install @trpc/server@^11 @trpc/client@^11 @trpc/react-query@^11
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('@trpc/server/package.json').version" && echo "OK"
```

Expected: prints a version like `11.x.x` then `OK`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @trpc/server, @trpc/client, @trpc/react-query"
```

---

### Task 2: Create tRPC foundation (main process)

**Files:**
- Create: `src/main/trpc.ts`

- [ ] **Step 1: Create tRPC initialization file**

Create `src/main/trpc.ts`:

```ts
import { initTRPC } from "@trpc/server"
import { EventEmitter } from "events"

export const ee = new EventEmitter()

const t = initTRPC.create({ isServer: true })

export const router = t.router
export const publicProcedure = t.procedure
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors related to `src/main/trpc.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/main/trpc.ts
git commit -m "feat: add tRPC initialization and shared event emitter"
```

---

### Task 3: Create preferences sub-router

**Files:**
- Create: `src/main/routers/preferences.ts`

- [ ] **Step 1: Create the preferences router**

Create `src/main/routers/preferences.ts`:

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/routers/preferences.ts
git commit -m "feat: add tRPC preferences sub-router"
```

---

### Task 4: Create projects sub-router

**Files:**
- Create: `src/main/routers/projects.ts`

- [ ] **Step 1: Create the projects router**

Create `src/main/routers/projects.ts`:

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/routers/projects.ts
git commit -m "feat: add tRPC projects sub-router"
```

---

### Task 5: Create appState sub-router

**Files:**
- Create: `src/main/routers/appState.ts`

- [ ] **Step 1: Create the appState router**

Create `src/main/routers/appState.ts`:

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/routers/appState.ts
git commit -m "feat: add tRPC appState sub-router"
```

---

### Task 6: Create appInfo sub-router

**Files:**
- Create: `src/main/routers/appInfo.ts`

- [ ] **Step 1: Create the appInfo router**

Create `src/main/routers/appInfo.ts`:

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/routers/appInfo.ts
git commit -m "feat: add tRPC appInfo sub-router"
```

---

### Task 7: Create window sub-router

**Files:**
- Create: `src/main/routers/window.ts`

- [ ] **Step 1: Create the window router**

Create `src/main/routers/window.ts`:

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/routers/window.ts
git commit -m "feat: add tRPC window sub-router"
```

---

### Task 8: Create merged appRouter and wire into main process

**Files:**
- Create: `src/main/router.ts`
- Modify: `src/main/main.ts`

- [ ] **Step 1: Create the merged router file**

Create `src/main/router.ts`:

```ts
import type Database from "better-sqlite3"
import type { BrowserWindow } from "electron"
import type { Preferences } from "@shared/schemas"
import { router } from "./trpc"
import { createPreferencesRouter } from "./routers/preferences"
import { createProjectsRouter } from "./routers/projects"
import { createAppStateRouter } from "./routers/appState"
import { createAppInfoRouter } from "./routers/appInfo"
import { createWindowRouter } from "./routers/window"

export function createAppRouter(deps: {
  db: Database.Database
  defaults: Preferences
  mainWindow: BrowserWindow
  getAppMainDirectory: () => string
}) {
  return router({
    preferences: createPreferencesRouter(deps.db, deps.defaults),
    projects: createProjectsRouter(deps.getAppMainDirectory),
    appState: createAppStateRouter(deps.db, deps.getAppMainDirectory),
    appInfo: createAppInfoRouter(),
    window: createWindowRouter(deps.mainWindow),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>
```

- [ ] **Step 2: Update main.ts to use createIPCHandler**

Replace the full content of `src/main/main.ts` with:

```ts
import { app, BrowserWindow } from "electron"
import path from "node:path"
import os from "node:os"
import fs from "node:fs"
import started from "electron-squirrel-startup"
import { createIPCHandler } from "electron-trpc-experimental/main"
import { openDb, cleanStaleAppState, initAppState, getPreferences, setPreferences } from "./db"
import { createAppRouter } from "./router"
import type { Preferences } from "@shared/schemas"

if (started) app.quit()

if (process.env.NODE_ENV === "development" || process.argv.includes("--dev")) {
  const port = process.env.DEBUG_PORT || "9333"
  app.commandLine.appendSwitch("remote-debugging-port", port)
  console.log(`Remote debugging enabled on port ${port}`)
}

function resolveDefaultPreferences(): Preferences {
  return {
    theme: "dark",
    fontSize: 14,
    appMainDirectory: path.join(os.homedir(), ".local", app.getName()),
  }
}

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "../../resources/icon.png"),
    frame: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: "detach" })
  }
  return mainWindow
}

app.on("ready", () => {
  // 1. Resolve bootstrap directory
  const bootstrapDir = path.join(os.homedir(), ".local", app.getName())
  fs.mkdirSync(bootstrapDir, { recursive: true })

  // 2. Open SQLite database
  const db = openDb(path.join(bootstrapDir, "app.db"))

  // 3. Clean stale app_state rows from previous crashed processes
  cleanStaleAppState(db)

  // 4. Load preferences (or write defaults)
  const defaults = resolveDefaultPreferences()
  const preferences = getPreferences(db, defaults)
  if (preferences === defaults) {
    setPreferences(db, defaults, defaults)
  }

  // 5. Ensure appMainDirectory exists
  fs.mkdirSync(preferences.appMainDirectory, { recursive: true })

  // 6. Register a fresh app_state row for this process
  initAppState(db, process.pid)

  // 7. Create the window
  const mainWindow = createWindow()

  // 8. Create tRPC router and attach IPC handler
  const getAppMainDirectory = () => getPreferences(db, defaults).appMainDirectory
  const appRouter = createAppRouter({ db, defaults, mainWindow, getAppMainDirectory })
  createIPCHandler({ router: appRouter, windows: [mainWindow] })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors related to `src/main/`. There will be errors in `src/renderer/` because the old handlers are still imported there — that's expected and fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/main/router.ts src/main/main.ts
git commit -m "feat: wire tRPC appRouter into main process via createIPCHandler"
```

---

### Task 9: Update preload and create renderer tRPC client

**Files:**
- Modify: `src/renderer/preload.ts`
- Create: `src/renderer/trpc.ts`

- [ ] **Step 1: Replace preload.ts**

Replace the full content of `src/renderer/preload.ts` with:

```ts
import { exposeElectronTRPC } from "electron-trpc-experimental/preload"

process.once("loaded", () => {
  exposeElectronTRPC()
})
```

- [ ] **Step 2: Create renderer tRPC client**

Create `src/renderer/trpc.ts`:

```ts
import { createTRPCReact } from "@trpc/react-query"
import { ipcLink } from "electron-trpc-experimental/renderer"
import type { AppRouter } from "@main/router"

export const trpc = createTRPCReact<AppRouter>()

export function createTRPCClient() {
  return trpc.createClient({
    links: [ipcLink()],
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/preload.ts src/renderer/trpc.ts
git commit -m "feat: add electron-trpc preload and renderer tRPC client"
```

---

### Task 10: Add trpc.Provider to App.tsx

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Wrap the app with trpc.Provider**

Replace the full content of `src/renderer/App.tsx` with:

```tsx
import "./index.css"
import React, { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { RouterProvider } from "@tanstack/react-router"
import { trpc, createTRPCClient } from "./trpc"
import { router } from "./router"

export default function App(): React.ReactElement {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 5_000,
          },
        },
      }),
  )
  const [trpcClient] = useState(() => createTRPCClient())

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: add trpc.Provider to App root"
```

---

### Task 11: Migrate __root.tsx (invalidation subscriptions)

**Files:**
- Modify: `src/renderer/routes/__root.tsx`

- [ ] **Step 1: Replace __root.tsx with tRPC subscriptions**

Replace the full content of `src/renderer/routes/__root.tsx` with:

```tsx
import React, { useEffect } from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Titlebar } from "@/components/titlebar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { ProjectSidebar } from "@/components/sidebar/project-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { CommandPalette } from "@/components/command-palette"
import { trpc } from "@/trpc"

function useInvalidationSubscriptions() {
  const utils = trpc.useUtils()

  trpc.preferences.onChange.useSubscription(undefined, {
    onData: () => void utils.preferences.get.invalidate(),
  })
  trpc.projects.onChange.useSubscription(undefined, {
    onData: () => void utils.projects.list.invalidate(),
  })
  trpc.appState.onChange.useSubscription(undefined, {
    onData: () => void utils.appState.get.invalidate(),
  })
}

function RootLayout(): React.ReactElement {
  useInvalidationSubscriptions()
  const { data: appState } = trpc.appState.get.useQuery()
  const { data: prefs } = trpc.preferences.get.useQuery()
  const isInProject = appState?.projectId != null

  useEffect(() => {
    if (!prefs) return
    document.documentElement.classList.toggle("dark", prefs.theme === "dark")
  }, [prefs?.theme])

  return (
    <SidebarProvider>
      <Titlebar />
      {isInProject ? <ProjectSidebar /> : <AppSidebar />}
      <SidebarInset>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  staticData: {},
})
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/routes/__root.tsx
git commit -m "feat: migrate __root.tsx to tRPC invalidation subscriptions"
```

---

### Task 12: Migrate titlebar.tsx

**Files:**
- Modify: `src/renderer/components/titlebar.tsx`

- [ ] **Step 1: Replace old hooks with tRPC calls**

Replace the full content of `src/renderer/components/titlebar.tsx` with:

```tsx
import React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Settings, Minus, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { trpc } from "@/trpc"

export function Titlebar(): React.ReactElement {
  const { data: appInfo } = trpc.appInfo.get.useQuery()
  const { data: appState } = trpc.appState.get.useQuery()
  const { data: projects } = trpc.projects.list.useQuery()
  const minimize = trpc.window.minimize.useMutation()
  const maximizeToggle = trpc.window.maximizeToggle.useMutation()
  const close = trpc.window.close.useMutation()
  const navigate = useNavigate()

  const platform = appInfo?.platform ?? ""
  const isDarwin = platform === "darwin"

  const project = appState?.projectId
    ? projects?.find((p) => p.id === appState.projectId)
    : null
  const centerTitle = project?.name ?? "Electrand"

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex h-10 items-center border-b bg-background px-2"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left zone */}
      <div
        className="relative z-10 flex items-center gap-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {!isDarwin && (
          <WindowControls
            minimize={() => minimize.mutate()}
            maximizeToggle={() => maximizeToggle.mutate()}
            close={() => close.mutate()}
          />
        )}
        <SidebarTrigger className={isDarwin ? "ml-[68px]" : ""} />
        <Separator orientation="vertical" className="h-4" />
      </div>

      {/* Center zone — absolutely centered */}
      <div className="absolute inset-x-0 text-center text-sm font-medium select-none pointer-events-none">
        {centerTitle}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right zone */}
      <div
        className="relative z-10 flex items-center"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigate({ to: "/preferences" })}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

function WindowControls({
  minimize,
  maximizeToggle,
  close,
}: {
  minimize: () => void
  maximizeToggle: () => void
  close: () => void
}): React.ReactElement {
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={minimize}
        className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-accent"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={maximizeToggle}
        className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-accent"
      >
        <Square className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={close}
        className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/titlebar.tsx
git commit -m "refactor: migrate titlebar to tRPC hooks"
```

---

### Task 13: Migrate command-palette.tsx

**Files:**
- Modify: `src/renderer/components/command-palette.tsx`

- [ ] **Step 1: Replace old hooks with tRPC calls**

Replace the full content of `src/renderer/components/command-palette.tsx` with:

```tsx
import React, { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { FolderOpen, Home, Info, Minus, Moon, Plus, Settings, Sun } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { trpc } from "@/trpc"

export function CommandPalette(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data: projects } = trpc.projects.list.useQuery()
  const { data: prefs } = trpc.preferences.get.useQuery()
  const setPrefs = trpc.preferences.set.useMutation()
  const setAppState = trpc.appState.set.useMutation()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function runAndClose(fn: () => void) {
    fn()
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                setAppState.mutate({ projectId: null })
                void navigate({ to: "/" })
              })
            }
          >
            <Home className="mr-2 h-4 w-4" />
            Home
            <CommandShortcut>⌘H</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                setAppState.mutate({ projectId: null })
                void navigate({ to: "/preferences" })
              })
            }
          >
            <Settings className="mr-2 h-4 w-4" />
            Preferences
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                setAppState.mutate({ projectId: null })
                void navigate({ to: "/about" })
              })
            }
          >
            <Info className="mr-2 h-4 w-4" />
            About
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Projects">
          {projects?.map((project) => (
            <CommandItem
              key={project.id}
              onSelect={() =>
                runAndClose(() => {
                  setAppState.mutate(
                    { projectId: project.id },
                    {
                      onSuccess: () =>
                        void navigate({
                          to: "/projects/$projectId",
                          params: { projectId: project.id },
                        }),
                    },
                  )
                })
              }
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {project.name}
            </CommandItem>
          ))}
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                setAppState.mutate({ projectId: null })
                void navigate({ to: "/" })
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Settings">
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                if (prefs) {
                  setPrefs.mutate({
                    theme: prefs.theme === "dark" ? "light" : "dark",
                  })
                }
              })
            }
          >
            {prefs?.theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            Toggle Theme
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                if (prefs && prefs.fontSize < 32) {
                  setPrefs.mutate({ fontSize: prefs.fontSize + 1 })
                }
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Increase Font Size
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                if (prefs && prefs.fontSize > 8) {
                  setPrefs.mutate({ fontSize: prefs.fontSize - 1 })
                }
              })
            }
          >
            <Minus className="mr-2 h-4 w-4" />
            Decrease Font Size
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/command-palette.tsx
git commit -m "refactor: migrate command palette to tRPC hooks"
```

---

### Task 14: Migrate project-sidebar.tsx

**Files:**
- Modify: `src/renderer/components/sidebar/project-sidebar.tsx`

- [ ] **Step 1: Replace old hooks with tRPC calls**

Replace the full content of `src/renderer/components/sidebar/project-sidebar.tsx` with:

```tsx
import React from "react"
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router"
import { FolderOpen, X } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { trpc } from "@/trpc"

export function ProjectSidebar(): React.ReactElement | null {
  const params = useParams({ strict: false }) as { projectId?: string }
  const projectId = params.projectId
  const { data: projects } = trpc.projects.list.useQuery()
  const setAppState = trpc.appState.set.useMutation()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (!projectId) return null

  const project = projects?.find((p) => p.id === projectId)

  const handleClose = (): void => {
    setAppState.mutate(
      { projectId: null },
      {
        onSuccess: () => void navigate({ to: "/" }),
        onError: (err) => console.error("Failed to close project:", err),
      },
    )
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <FolderOpen className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none overflow-hidden">
                  <span className="font-semibold truncate">{project?.name ?? "Project"}</span>
                  <span className="text-xs text-muted-foreground">Project</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `/projects/${projectId}`}>
                <Link to="/projects/$projectId" params={{ projectId }}>
                  Overview
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `/projects/${projectId}/settings`}>
                <Link to="/projects/$projectId/settings" params={{ projectId }}>
                  Settings
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleClose}>
              <X className="size-4" />
              Close Project
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/sidebar/project-sidebar.tsx
git commit -m "refactor: migrate project sidebar to tRPC hooks"
```

---

### Task 15: Migrate route files

**Files:**
- Modify: `src/renderer/routes/index.tsx`
- Modify: `src/renderer/routes/about.tsx`
- Modify: `src/renderer/routes/preferences.tsx`
- Modify: `src/renderer/routes/projects/$projectId/route.tsx`
- Modify: `src/renderer/routes/projects/$projectId/index.tsx`
- Modify: `src/renderer/routes/projects/$projectId/settings.tsx`

- [ ] **Step 1: Migrate routes/index.tsx**

In `src/renderer/routes/index.tsx`, replace the import lines:

```ts
// OLD:
import { useProjects, useCreateProject } from "@/hooks/use-projects"
import { useSetAppState } from "@/hooks/use-app-state"
```

with:

```ts
import { trpc } from "@/trpc"
```

Then replace the hook calls inside `NewProjectForm`:

```ts
// OLD:
const createProject = useCreateProject()
```

with:

```ts
const createProject = trpc.projects.create.useMutation()
```

And inside `HomeScreen`:

```ts
// OLD:
const { data: projects, isLoading } = useProjects()
const setAppState = useSetAppState()
```

with:

```ts
const { data: projects, isLoading } = trpc.projects.list.useQuery()
const setAppState = trpc.appState.set.useMutation()
```

- [ ] **Step 2: Migrate routes/about.tsx**

Replace the full content of `src/renderer/routes/about.tsx` with:

```tsx
import React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { trpc } from "@/trpc"
import { PageContent, PageMeta, PageTitle } from "@/components/ui/page"

export const Route = createFileRoute("/about")({
  component: AboutScreen,
  staticData: { title: "About" },
})

function AboutScreen(): React.ReactElement {
  const { data: info, isLoading } = trpc.appInfo.get.useQuery()

  if (isLoading || !info) {
    return <p className="text-sm text-muted-foreground p-6">Loading…</p>
  }

  const rows: [string, string][] = [
    ["Version", info.version],
    ["Electron", info.versions.electron],
    ["Node", info.versions.node],
    ["Chrome", info.versions.chrome],
  ]

  return (
    <PageContent narrow>
      <PageTitle>{info.name}</PageTitle>
      <PageMeta rows={rows} />
    </PageContent>
  )
}
```

- [ ] **Step 3: Migrate routes/preferences.tsx**

Replace the full content of `src/renderer/routes/preferences.tsx` with:

```tsx
import React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FolderOpen } from "lucide-react"
import { trpc } from "@/trpc"
import { PageContent, PageSection, PageTitle } from "@/components/ui/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/preferences")({
  component: PreferencesScreen,
  staticData: { title: "Preferences" },
})

function PreferencesScreen(): React.ReactElement {
  const { data: prefs, isLoading } = trpc.preferences.get.useQuery()
  const setPrefs = trpc.preferences.set.useMutation()
  const selectDirectory = trpc.window.selectDirectory.useMutation()

  if (isLoading || !prefs) {
    return <p className="text-sm text-muted-foreground p-6">Loading…</p>
  }

  return (
    <PageContent narrow>
      <PageTitle>Preferences</PageTitle>

      <PageSection title="Appearance">
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm">Theme</span>
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setPrefs.mutate({ theme: prefs.theme === "dark" ? "light" : "dark" })}
            >
              {prefs.theme === "dark" ? "Dark" : "Light"}
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm">Font size</span>
            <div className="flex items-center gap-2">
              <button
                className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-accent disabled:opacity-40"
                onClick={() => setPrefs.mutate({ fontSize: prefs.fontSize - 1 })}
                disabled={prefs.fontSize <= 8}
              >
                −
              </button>
              <span className="w-10 text-center text-sm tabular-nums">{prefs.fontSize}px</span>
              <button
                className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-accent disabled:opacity-40"
                onClick={() => setPrefs.mutate({ fontSize: prefs.fontSize + 1 })}
                disabled={prefs.fontSize >= 32}
              >
                +
              </button>
            </div>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection title="Storage">
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">App data directory</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{prefs.appMainDirectory}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-4 shrink-0"
              onClick={async () => {
                const dir = await selectDirectory.mutateAsync()
                if (dir) setPrefs.mutate({ appMainDirectory: dir })
              }}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Change
            </Button>
          </CardContent>
        </Card>
      </PageSection>
    </PageContent>
  )
}
```

- [ ] **Step 4: Migrate routes/projects/$projectId/route.tsx**

Replace the full content of `src/renderer/routes/projects/$projectId/route.tsx` with:

```tsx
import React, { useEffect } from "react"
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router"
import { trpc } from "@/trpc"

function ProjectLayout(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId" })
  const setAppState = trpc.appState.set.useMutation()
  const { data: projects } = trpc.projects.list.useQuery()
  const project = projects?.find((p) => p.id === projectId)

  useEffect(() => {
    setAppState.mutate(
      { projectId },
      { onError: (err) => console.error("Failed to set active project:", err) },
    )
  }, [projectId])

  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>
  }

  return <Outlet />
}

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectLayout,
  staticData: {},
})
```

- [ ] **Step 5: Migrate routes/projects/$projectId/index.tsx**

Replace the full content of `src/renderer/routes/projects/$projectId/index.tsx` with:

```tsx
import React from "react"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { trpc } from "@/trpc"
import { PageContent, PageMeta, PageTitle } from "@/components/ui/page"

export const Route = createFileRoute("/projects/$projectId/")({
  component: ProjectOverview,
  staticData: { title: "Overview" },
})

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

function ProjectOverview(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId/" })
  const { data: projects } = trpc.projects.list.useQuery()
  const project = projects?.find((p) => p.id === projectId)

  if (!project) return <p className="text-sm text-muted-foreground p-6">Loading…</p>

  const rows: [string, string][] = [
    ["Path", project.path],
    ["Created", formatDate(project.createdAt)],
    ["Last updated", formatDate(project.updatedAt)],
    ["Last opened", project.lastOpenedAt ? formatDate(project.lastOpenedAt) : "—"],
  ]

  return (
    <PageContent>
      <PageTitle>{project.name}</PageTitle>
      <PageMeta rows={rows} />
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Project workspace — extend this area with your app-specific content.
      </div>
    </PageContent>
  )
}
```

- [ ] **Step 6: Migrate routes/projects/$projectId/settings.tsx**

Replace the full content of `src/renderer/routes/projects/$projectId/settings.tsx` with:

```tsx
import React, { useState, useEffect } from "react"
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { trpc } from "@/trpc"
import { PageContent, PageSection, PageTitle } from "@/components/ui/page"

export const Route = createFileRoute("/projects/$projectId/settings")({
  component: ProjectSettings,
  staticData: { title: "Project Settings" },
})

function ProjectSettings(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId/settings" })
  const { data: projects } = trpc.projects.list.useQuery()
  const project = projects?.find((p) => p.id === projectId)

  const updateProject = trpc.projects.update.useMutation()
  const deleteProject = trpc.projects.delete.useMutation()
  const setAppState = trpc.appState.set.useMutation()
  const navigate = useNavigate()

  const [name, setName] = useState(project?.name ?? "")
  const [projectPath, setProjectPath] = useState(project?.path ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (project) {
      setName(project.name)
      setProjectPath(project.path)
    }
  }, [project?.id])

  if (!project) return <p className="text-sm text-muted-foreground p-6">Loading…</p>

  const isDirty = name !== project.name || projectPath !== project.path

  const handleSave = (): void => {
    updateProject.mutate(
      { id: projectId, name, path: projectPath },
      { onError: (err) => console.error("Failed to save project:", err) },
    )
  }

  const handleDelete = (): void => {
    deleteProject.mutate(
      { id: projectId },
      {
        onSuccess: () => {
          setAppState.mutate(
            { projectId: null },
            {
              onSuccess: () => void navigate({ to: "/" }),
              onError: (err) => console.error("Failed to clear active project:", err),
            },
          )
        },
        onError: (err) => console.error("Failed to delete project:", err),
      },
    )
  }

  return (
    <PageContent narrow>
      <PageTitle>Project Settings</PageTitle>

      <PageSection title="General">
        <div className="flex flex-col gap-2">
          <label htmlFor="project-name" className="text-sm text-muted-foreground">
            Name
          </label>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="project-path" className="text-sm text-muted-foreground">
            Path
          </label>
          <Input
            id="project-path"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
          />
        </div>
        <Button size="sm" disabled={!isDirty || updateProject.isPending} onClick={handleSave}>
          {updateProject.isPending ? "Saving…" : "Save changes"}
        </Button>
      </PageSection>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Deleting a project removes its folder and all associated data permanently.
          </p>
          {!confirmDelete ? (
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete project
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={deleteProject.isPending}
                onClick={handleDelete}
              >
                {deleteProject.isPending ? "Deleting…" : "Confirm delete"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContent>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/routes/index.tsx src/renderer/routes/about.tsx src/renderer/routes/preferences.tsx src/renderer/routes/projects/\$projectId/route.tsx src/renderer/routes/projects/\$projectId/index.tsx src/renderer/routes/projects/\$projectId/settings.tsx
git commit -m "refactor: migrate all route files to tRPC hooks"
```

---

### Task 16: Delete old IPC files

**Files:**
- Delete: `src/renderer/bridge.ts`
- Delete: `src/renderer/hooks/use-projects.ts`
- Delete: `src/renderer/hooks/use-preferences.ts`
- Delete: `src/renderer/hooks/use-app-state.ts`
- Delete: `src/renderer/hooks/use-app-info.ts`
- Delete: `src/renderer/hooks/use-window-controls.ts`
- Delete: `src/renderer/hooks/use-ipc-invalidation.ts`
- Delete: `src/main/handlers/preferences.ts`
- Delete: `src/main/handlers/projects.ts`
- Delete: `src/main/handlers/appState.ts`
- Delete: `src/main/handlers/appInfo.ts`
- Delete: `src/main/handlers/window.ts`

- [ ] **Step 1: Verify no remaining imports to old files**

```bash
grep -r "from.*@/hooks/use-" src/renderer/ --include="*.ts" --include="*.tsx"
grep -r "from.*./bridge" src/renderer/ --include="*.ts" --include="*.tsx"
grep -r "from.*./handlers/" src/main/ --include="*.ts"
grep -r "window.__electrand" src/renderer/ --include="*.ts" --include="*.tsx"
```

Expected: No matches from any of these commands.

- [ ] **Step 2: Delete renderer files**

```bash
rm src/renderer/bridge.ts
rm src/renderer/hooks/use-projects.ts
rm src/renderer/hooks/use-preferences.ts
rm src/renderer/hooks/use-app-state.ts
rm src/renderer/hooks/use-app-info.ts
rm src/renderer/hooks/use-window-controls.ts
rm src/renderer/hooks/use-ipc-invalidation.ts
```

- [ ] **Step 3: Delete main handler files**

```bash
rm src/main/handlers/preferences.ts
rm src/main/handlers/projects.ts
rm src/main/handlers/appState.ts
rm src/main/handlers/appInfo.ts
rm src/main/handlers/window.ts
```

- [ ] **Step 4: Remove empty directories if applicable**

```bash
rmdir src/renderer/hooks 2>/dev/null || true
rmdir src/main/handlers 2>/dev/null || true
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove old IPC bridge, hooks, and handler files"
```

---

### Task 17: Build and smoke test

- [ ] **Step 1: Run the full build**

```bash
npm run package
```

Expected: Builds without errors. If there are Vite build errors, they will point to unresolved imports or type issues — fix them before proceeding.

- [ ] **Step 2: Start the app in dev mode**

```bash
npm start
```

Verify the following:

1. App launches without console errors
2. Home screen loads and shows projects list (or empty state)
3. Create a new project — it appears in the list
4. Open a project — title bar shows project name, sidebar switches to project sidebar
5. Navigate to project settings — update name, verify it saves
6. Delete a project — redirects to home, project is gone
7. Open preferences — toggle theme, change font size, change directory (via file dialog)
8. Command palette (⌘K) — navigate, toggle theme, open projects
9. About page shows version info
10. Titlebar window controls work (minimize, maximize, close — Windows/Linux only)

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
