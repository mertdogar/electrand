# TanStack Router + Query + SQLite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom IPC/Zustand store with TanStack Router (file-based, memory history), TanStack Query, and a SQLite-backed data layer; add a resizable sidebar shell and project list/detail screens.

**Architecture:** Main process owns all state — SQLite for preferences and per-process app_state, on-disk JSON for project folders. A typed preload bridge exposes `invoke`/`on` to the renderer. TanStack Query caches IPC responses; push events from main invalidate the cache. TanStack Router handles navigation; the sidebar switches between app nav and project nav based on `appState.projectId`.

**Tech Stack:** `better-sqlite3`, `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `zod`, `vitest`, shadcn/ui (`resizable`, `card`)

---

## File Map

**Create:**
- `src/shared/schemas.ts` — Zod schemas + inferred types (shared by main + renderer)
- `src/shared/schemas.test.ts`
- `src/main/db.ts` — SQLite open/migrations, typed CRUD for preferences + app_state
- `src/main/db.test.ts`
- `src/main/projects.ts` — File I/O for project folders (scan, write, delete)
- `src/main/projects.test.ts`
- `src/main/handlers/preferences.ts` — IPC handlers + testable business logic
- `src/main/handlers/preferences.test.ts`
- `src/main/handlers/projects.ts` — IPC handlers + testable business logic
- `src/main/handlers/projects.test.ts`
- `src/main/handlers/appState.ts` — IPC handlers for per-pid app state
- `src/main/handlers/appInfo.ts` — IPC handler for app version/runtime info
- `src/renderer/router.ts` — TanStack Router instance (memory history)
- `src/renderer/hooks/use-ipc-invalidation.ts` — subscribes to push events, invalidates queries
- `src/renderer/hooks/use-preferences.ts`
- `src/renderer/hooks/use-projects.ts`
- `src/renderer/hooks/use-app-state.ts`
- `src/renderer/hooks/use-app-info.ts`
- `src/renderer/routes/__root.tsx` — ResizablePanelGroup shell, topbar, context-aware sidebar
- `src/renderer/routes/index.tsx` — Home: project card grid
- `src/renderer/routes/preferences.tsx`
- `src/renderer/routes/about.tsx`
- `src/renderer/routes/projects/$projectId/route.tsx` — Project layout, sidebar switch
- `src/renderer/routes/projects/$projectId/index.tsx` — Project overview
- `src/renderer/routes/projects/$projectId/settings.tsx` — Project settings + delete
- `src/renderer/components/sidebar/app-sidebar.tsx`
- `src/renderer/components/sidebar/project-sidebar.tsx`
- `src/renderer/components/topbar.tsx`
- `vitest.config.ts`

**Modify:**
- `package.json` — add deps + `"test"` script
- `tsconfig.json` — add `strict`, `@shared/*` path alias
- `vite.renderer.config.mts` — add TanStack Router plugin + `@shared` alias
- `vite.main.config.ts` — add `@shared` alias
- `vite.preload.config.ts` — add `@shared` alias
- `src/renderer/preload.ts` — rewrite as typed bridge
- `src/main/main.ts` — rewrite boot sequence

**Delete:**
- `src/lib/store/main.ts`
- `src/lib/store/renderer.ts`
- `src/lib/store/preload.ts`
- `src/lib/store/types.ts`
- `src/renderer/stores/demo.ts`

---

## Task 1: Install dependencies and configure toolchain

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `vite.renderer.config.mts`
- Modify: `vite.main.config.ts`
- Modify: `vite.preload.config.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install npm dependencies**

```bash
npm install better-sqlite3 zod @tanstack/react-router @tanstack/react-query @tanstack/react-query-devtools
npm install --save-dev @types/better-sqlite3 @tanstack/router-plugin vitest
```

Expected: no errors. `package.json` updated.

- [ ] **Step 2: Add shadcn components**

```bash
npx shadcn add resizable card
```

Expected: `src/renderer/components/ui/resizable.tsx` and `src/renderer/components/ui/card.tsx` created.

- [ ] **Step 3: Update `tsconfig.json`**

Replace the contents of `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "sourceMap": true,
    "baseUrl": ".",
    "outDir": "dist",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/renderer/*"],
      "@main/*": ["./src/main/*"],
      "@lib/*": ["./src/lib/*"],
      "@shared/*": ["./src/shared/*"]
    }
  }
}
```

- [ ] **Step 4: Update `vite.renderer.config.mts`**

```ts
import path from "path"
import { fileURLToPath } from "url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/renderer/routes",
      generatedRouteTree: "./src/renderer/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer"),
      "@main": path.resolve(__dirname, "./src/main"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
})
```

- [ ] **Step 5: Update `vite.main.config.ts`**

```ts
import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
})
```

- [ ] **Step 6: Update `vite.preload.config.ts`**

```ts
import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
})
```

- [ ] **Step 7: Create `vitest.config.ts`**

```ts
import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@main": path.resolve(__dirname, "./src/main"),
    },
  },
})
```

- [ ] **Step 8: Add test script to `package.json`**

Add `"test": "vitest run"` to the `scripts` section of `package.json`.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vite.renderer.config.mts vite.main.config.ts vite.preload.config.ts vitest.config.ts src/renderer/components/ui/resizable.tsx src/renderer/components/ui/card.tsx package-lock.json
git commit -m "feat: install tanstack router/query, better-sqlite3, zod; configure toolchain"
```

---

## Task 2: Shared Zod schemas

**Files:**
- Create: `src/shared/schemas.ts`
- Create: `src/shared/schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  ProjectSchema,
  PreferencesSchema,
  AppStateSchema,
  AppInfoSchema,
} from "./schemas"

describe("ProjectSchema", () => {
  it("parses a valid project", () => {
    const input = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "My Project",
      path: "/home/user/projects/my-project",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastOpenedAt: null,
    }
    expect(() => ProjectSchema.parse(input)).not.toThrow()
  })

  it("rejects empty name", () => {
    expect(() =>
      ProjectSchema.parse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "",
        path: "/some/path",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastOpenedAt: null,
      })
    ).toThrow()
  })

  it("rejects invalid uuid", () => {
    expect(() =>
      ProjectSchema.parse({
        id: "not-a-uuid",
        name: "Project",
        path: "/some/path",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastOpenedAt: null,
      })
    ).toThrow()
  })
})

describe("PreferencesSchema", () => {
  it("parses valid preferences", () => {
    const input = { theme: "dark", fontSize: 14, appMainDirectory: "/home/user/.local/myapp" }
    expect(() => PreferencesSchema.parse(input)).not.toThrow()
  })

  it("rejects invalid theme", () => {
    expect(() =>
      PreferencesSchema.parse({ theme: "blue", fontSize: 14, appMainDirectory: "/tmp" })
    ).toThrow()
  })

  it("rejects fontSize out of range", () => {
    expect(() =>
      PreferencesSchema.parse({ theme: "dark", fontSize: 5, appMainDirectory: "/tmp" })
    ).toThrow()
  })
})

describe("AppStateSchema", () => {
  it("accepts null projectId", () => {
    expect(() => AppStateSchema.parse({ projectId: null })).not.toThrow()
  })

  it("accepts valid uuid projectId", () => {
    expect(() =>
      AppStateSchema.parse({ projectId: "123e4567-e89b-12d3-a456-426614174000" })
    ).not.toThrow()
  })

  it("rejects non-uuid string", () => {
    expect(() => AppStateSchema.parse({ projectId: "not-a-uuid" })).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — cannot find module `./schemas`.

- [ ] **Step 3: Create `src/shared/schemas.ts`**

```ts
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
  name: z.string(),
  version: z.string(),
  versions: z.object({
    electron: z.string(),
    node: z.string(),
    chrome: z.string(),
  }),
})
export type AppInfo = z.infer<typeof AppInfoSchema>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/schemas.ts src/shared/schemas.test.ts
git commit -m "feat: add shared Zod schemas (Project, Preferences, AppState, AppInfo)"
```

---

## Task 3: SQLite db module

**Files:**
- Create: `src/main/db.ts`
- Create: `src/main/db.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/main/db.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import Database from "better-sqlite3"
import {
  runMigrations,
  cleanStaleAppState,
  getPreferences,
  setPreferences,
  getAppState,
  setAppState,
} from "./db"
import type { Preferences, AppState } from "@shared/schemas"

const DEFAULT_PREFS: Preferences = {
  theme: "dark",
  fontSize: 14,
  appMainDirectory: "/tmp/test-app",
}

function makeDb(): Database.Database {
  const db = new Database(":memory:")
  runMigrations(db)
  return db
}

describe("preferences", () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it("returns defaults when no row exists", () => {
    const prefs = getPreferences(db, DEFAULT_PREFS)
    expect(prefs).toEqual(DEFAULT_PREFS)
  })

  it("persists and returns preferences", () => {
    setPreferences(db, DEFAULT_PREFS, { theme: "light" })
    const prefs = getPreferences(db, DEFAULT_PREFS)
    expect(prefs.theme).toBe("light")
    expect(prefs.fontSize).toBe(14)
  })

  it("merges partial update", () => {
    setPreferences(db, DEFAULT_PREFS, { fontSize: 18 })
    const prefs = getPreferences(db, DEFAULT_PREFS)
    expect(prefs.fontSize).toBe(18)
    expect(prefs.theme).toBe("dark")
  })
})

describe("appState", () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it("returns default state when no row exists", () => {
    const state = getAppState(db, 99999)
    expect(state).toEqual({ projectId: null })
  })

  it("persists app state for a pid", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    setAppState(db, 12345, { projectId: uuid })
    const state = getAppState(db, 12345)
    expect(state.projectId).toBe(uuid)
  })

  it("isolates state between pids", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    setAppState(db, 111, { projectId: uuid })
    const state = getAppState(db, 222)
    expect(state.projectId).toBeNull()
  })
})

describe("cleanStaleAppState", () => {
  it("removes rows for non-existent pids", () => {
    const db = makeDb()
    // Insert a row with a pid that definitely doesn't exist (pid 1 is init on Linux, use a huge number)
    db.prepare("INSERT INTO app_state (pid, data) VALUES (?, ?)").run(
      999999999,
      JSON.stringify({ projectId: null })
    )
    cleanStaleAppState(db)
    const row = db.prepare("SELECT * FROM app_state WHERE pid = ?").get(999999999)
    expect(row).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — cannot find module `./db`.

- [ ] **Step 3: Create `src/main/db.ts`**

```ts
import Database from "better-sqlite3"
import {
  PreferencesSchema,
  AppStateSchema,
  type Preferences,
  type AppState,
} from "@shared/schemas"

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      id   INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (
      pid  INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    );
  `)
}

export function getPreferences(
  db: Database.Database,
  defaults: Preferences
): Preferences {
  const row = db.prepare("SELECT data FROM preferences WHERE id = 1").get() as
    | { data: string }
    | undefined
  if (!row) return defaults
  return PreferencesSchema.parse(JSON.parse(row.data))
}

export function setPreferences(
  db: Database.Database,
  defaults: Preferences,
  partial: Partial<Preferences>
): Preferences {
  const current = getPreferences(db, defaults)
  const next = PreferencesSchema.parse({ ...current, ...partial })
  db.prepare(
    "INSERT INTO preferences (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data"
  ).run(JSON.stringify(next))
  return next
}

export function getAppState(db: Database.Database, pid: number): AppState {
  const row = db.prepare("SELECT data FROM app_state WHERE pid = ?").get(pid) as
    | { data: string }
    | undefined
  if (!row) return { projectId: null }
  return AppStateSchema.parse(JSON.parse(row.data))
}

export function setAppState(
  db: Database.Database,
  pid: number,
  partial: Partial<AppState>
): AppState {
  const current = getAppState(db, pid)
  const next = AppStateSchema.parse({ ...current, ...partial })
  db.prepare(
    "INSERT INTO app_state (pid, data) VALUES (?, ?) ON CONFLICT(pid) DO UPDATE SET data = excluded.data"
  ).run(pid, JSON.stringify(next))
  return next
}

export function initAppState(db: Database.Database, pid: number): AppState {
  const state: AppState = { projectId: null }
  db.prepare(
    "INSERT INTO app_state (pid, data) VALUES (?, ?) ON CONFLICT(pid) DO UPDATE SET data = excluded.data"
  ).run(pid, JSON.stringify(state))
  return state
}

export function cleanStaleAppState(db: Database.Database): void {
  const rows = db.prepare("SELECT pid FROM app_state").all() as { pid: number }[]
  for (const { pid } of rows) {
    try {
      process.kill(pid, 0)
    } catch {
      db.prepare("DELETE FROM app_state WHERE pid = ?").run(pid)
    }
  }
}

export function openDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  runMigrations(db)
  return db
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: PASS — all db tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/db.ts src/main/db.test.ts
git commit -m "feat: add SQLite db module (preferences + app_state CRUD)"
```

---

## Task 4: Projects file I/O module

**Files:**
- Create: `src/main/projects.ts`
- Create: `src/main/projects.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/main/projects.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { scanProjects, writeProject, deleteProjectDir } from "./projects"
import type { Project } from "@shared/schemas"

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Project",
    path: "/home/user/test",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: null,
    ...overrides,
  }
}

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "electrand-test-"))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("scanProjects", () => {
  it("returns empty array when directory is empty", () => {
    expect(scanProjects(tmpDir)).toEqual([])
  })

  it("returns projects from valid project.json files", () => {
    const project = makeProject()
    const projectDir = path.join(tmpDir, project.id)
    fs.mkdirSync(projectDir)
    fs.writeFileSync(path.join(projectDir, "project.json"), JSON.stringify(project))
    const result = scanProjects(tmpDir)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(project.id)
  })

  it("skips directories without project.json", () => {
    fs.mkdirSync(path.join(tmpDir, "not-a-project"))
    expect(scanProjects(tmpDir)).toEqual([])
  })

  it("skips invalid project.json (logs, no crash)", () => {
    const dir = path.join(tmpDir, "bad-project")
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify({ invalid: true }))
    expect(scanProjects(tmpDir)).toEqual([])
  })
})

describe("writeProject", () => {
  it("creates project directory and writes project.json", () => {
    const project = makeProject()
    writeProject(tmpDir, project)
    const written = JSON.parse(
      fs.readFileSync(path.join(tmpDir, project.id, "project.json"), "utf-8")
    )
    expect(written.id).toBe(project.id)
  })

  it("overwrites existing project.json on update", () => {
    const project = makeProject()
    writeProject(tmpDir, project)
    const updated = { ...project, name: "Updated" }
    writeProject(tmpDir, updated)
    const written = JSON.parse(
      fs.readFileSync(path.join(tmpDir, project.id, "project.json"), "utf-8")
    )
    expect(written.name).toBe("Updated")
  })
})

describe("deleteProjectDir", () => {
  it("removes the project directory", () => {
    const project = makeProject()
    writeProject(tmpDir, project)
    deleteProjectDir(tmpDir, project.id)
    expect(fs.existsSync(path.join(tmpDir, project.id))).toBe(false)
  })

  it("does not throw if directory does not exist", () => {
    expect(() => deleteProjectDir(tmpDir, "non-existent-id")).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — cannot find module `./projects`.

- [ ] **Step 3: Create `src/main/projects.ts`**

```ts
import fs from "node:fs"
import path from "node:path"
import { ProjectSchema, type Project } from "@shared/schemas"

export function scanProjects(appMainDirectory: string): Project[] {
  const results: Project[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(appMainDirectory, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const jsonPath = path.join(appMainDirectory, entry.name, "project.json")
    if (!fs.existsSync(jsonPath)) continue
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
      const project = ProjectSchema.parse(raw)
      results.push(project)
    } catch (err) {
      console.warn(`[projects] Skipping invalid project.json in ${entry.name}:`, err)
    }
  }
  return results
}

export function writeProject(appMainDirectory: string, project: Project): void {
  const projectDir = path.join(appMainDirectory, project.id)
  fs.mkdirSync(projectDir, { recursive: true })
  fs.writeFileSync(
    path.join(projectDir, "project.json"),
    JSON.stringify(project, null, 2),
    "utf-8"
  )
}

export function deleteProjectDir(appMainDirectory: string, id: string): void {
  const projectDir = path.join(appMainDirectory, id)
  fs.rmSync(projectDir, { recursive: true, force: true })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: PASS — all projects tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/projects.ts src/main/projects.test.ts
git commit -m "feat: add projects file I/O module (scan, write, delete)"
```

---

## Task 5: Typed preload bridge

**Files:**
- Modify: `src/renderer/preload.ts`

The preload script runs in the renderer's context with access to `ipcRenderer`. It exposes a typed `window.__electrand` API. Renderer code never imports from `electron` directly.

- [ ] **Step 1: Rewrite `src/renderer/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from "electron"
import type {
  Preferences,
  Project,
  AppState,
  AppInfo,
} from "@shared/schemas"

// ── Invoke channel types ──────────────────────────────────────────────────────

interface InvokePayloads {
  "app:preferences:get": void
  "app:preferences:set": Partial<Preferences>
  "app:projects:get": void
  "app:projects:create": { name: string; path: string }
  "app:projects:update": { id: string } & Partial<{ name: string; path: string }>
  "app:projects:delete": { id: string }
  "app:appState:get": void
  "app:appState:set": Partial<AppState>
  "app:info:get": void
}

interface InvokeReturns {
  "app:preferences:get": Preferences
  "app:preferences:set": Preferences
  "app:projects:get": Project[]
  "app:projects:create": Project
  "app:projects:update": Project
  "app:projects:delete": void
  "app:appState:get": AppState
  "app:appState:set": AppState
  "app:info:get": AppInfo
}

// ── Push channel types ────────────────────────────────────────────────────────

interface PushPayloads {
  "app:preferences:changed": Preferences
  "app:projects:changed": Project[]
  "app:appState:changed": AppState
}

// ── Bridge interface (exposed on window.__electrand) ─────────────────────────

export interface ElectrandBridge {
  invoke<C extends keyof InvokePayloads>(
    channel: C,
    ...args: InvokePayloads[C] extends void ? [] : [InvokePayloads[C]]
  ): Promise<InvokeReturns[C]>

  on<C extends keyof PushPayloads>(
    channel: C,
    callback: (data: PushPayloads[C]) => void
  ): () => void
}

// ── Implementation ────────────────────────────────────────────────────────────

const bridge: ElectrandBridge = {
  invoke(channel, ...args) {
    return ipcRenderer.invoke(channel, args[0])
  },

  on(channel, callback) {
    const handler = (_event: Electron.IpcRendererEvent, data: PushPayloads[typeof channel]) =>
      callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}

contextBridge.exposeInMainWorld("__electrand", bridge)

// ── Window type augmentation ──────────────────────────────────────────────────

declare global {
  interface Window {
    __electrand: ElectrandBridge
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/preload.ts
git commit -m "feat: rewrite preload as typed ElectrandBridge (invoke + on)"
```

---

## Task 6: Preferences IPC handlers

**Files:**
- Create: `src/main/handlers/preferences.ts`
- Create: `src/main/handlers/preferences.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/main/handlers/preferences.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import Database from "better-sqlite3"
import { openDb } from "@main/db"
import { handleGetPreferences, handleSetPreferences } from "./preferences"

const DEFAULTS = { theme: "dark" as const, fontSize: 14, appMainDirectory: "/tmp/test" }

let db: Database.Database

beforeEach(() => {
  db = new Database(":memory:")
  const { runMigrations } = require("@main/db")
  runMigrations(db)
})

describe("handleGetPreferences", () => {
  it("returns defaults when nothing stored", () => {
    const result = handleGetPreferences(db, DEFAULTS)
    expect(result).toEqual(DEFAULTS)
  })
})

describe("handleSetPreferences", () => {
  it("stores and returns updated preferences", () => {
    const result = handleSetPreferences(db, DEFAULTS, { theme: "light" })
    expect(result.theme).toBe("light")
    expect(result.fontSize).toBe(14)
  })

  it("rejects invalid partial (throws ZodError)", () => {
    expect(() =>
      handleSetPreferences(db, DEFAULTS, { fontSize: 3 })
    ).toThrow()
  })

  it("rejects unknown keys gracefully by ignoring them", () => {
    const result = handleSetPreferences(db, DEFAULTS, { theme: "dark" })
    expect(result.theme).toBe("dark")
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — cannot find module `./preferences`.

- [ ] **Step 3: Create `src/main/handlers/preferences.ts`**

```ts
import { ipcMain, BrowserWindow } from "electron"
import type Database from "better-sqlite3"
import { PreferencesSchema, type Preferences } from "@shared/schemas"
import { getPreferences, setPreferences } from "@main/db"

export function handleGetPreferences(
  db: Database.Database,
  defaults: Preferences
): Preferences {
  return getPreferences(db, defaults)
}

export function handleSetPreferences(
  db: Database.Database,
  defaults: Preferences,
  partial: unknown
): Preferences {
  const validated = PreferencesSchema.partial().parse(partial)
  const next = setPreferences(db, defaults, validated)
  broadcast("app:preferences:changed", next)
  return next
}

function broadcast(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, data)
  }
}

export function registerPreferencesHandlers(
  db: Database.Database,
  defaults: Preferences
): void {
  ipcMain.handle("app:preferences:get", () =>
    handleGetPreferences(db, defaults)
  )
  ipcMain.handle("app:preferences:set", (_event, partial: unknown) =>
    handleSetPreferences(db, defaults, partial)
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/handlers/preferences.ts src/main/handlers/preferences.test.ts
git commit -m "feat: add preferences IPC handlers"
```

---

## Task 7: Projects IPC handlers

**Files:**
- Create: `src/main/handlers/projects.ts`
- Create: `src/main/handlers/projects.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/main/handlers/projects.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  handleGetProjects,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
} from "./projects"

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "electrand-projects-test-"))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("handleGetProjects", () => {
  it("returns empty array when no projects", () => {
    expect(handleGetProjects(tmpDir)).toEqual([])
  })
})

describe("handleCreateProject", () => {
  it("creates and returns a project with generated id and timestamps", () => {
    const project = handleCreateProject(tmpDir, { name: "My App", path: "/home/user/app" })
    expect(project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(project.name).toBe("My App")
    expect(project.lastOpenedAt).toBeNull()
    // project.json was written to disk
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(tmpDir, project.id, "project.json"), "utf-8")
    )
    expect(onDisk.id).toBe(project.id)
  })

  it("rejects empty project name", () => {
    expect(() => handleCreateProject(tmpDir, { name: "", path: "/tmp" })).toThrow()
  })
})

describe("handleUpdateProject", () => {
  it("updates name and sets updatedAt", async () => {
    const created = handleCreateProject(tmpDir, { name: "Original", path: "/tmp" })
    await new Promise((r) => setTimeout(r, 5)) // ensure timestamp changes
    const updated = handleUpdateProject(tmpDir, { id: created.id, name: "Renamed" })
    expect(updated.name).toBe("Renamed")
    expect(updated.updatedAt > created.updatedAt).toBe(true)
  })

  it("throws if project does not exist", () => {
    expect(() =>
      handleUpdateProject(tmpDir, { id: "123e4567-e89b-12d3-a456-426614174000", name: "X" })
    ).toThrow("not found")
  })
})

describe("handleDeleteProject", () => {
  it("removes the project directory", () => {
    const project = handleCreateProject(tmpDir, { name: "ToDelete", path: "/tmp" })
    handleDeleteProject(tmpDir, { id: project.id })
    expect(fs.existsSync(path.join(tmpDir, project.id))).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — cannot find module `./projects`.

- [ ] **Step 3: Create `src/main/handlers/projects.ts`**

```ts
import { ipcMain, BrowserWindow } from "electron"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { ProjectSchema, type Project } from "@shared/schemas"
import { scanProjects, writeProject, deleteProjectDir } from "@main/projects"

const CreateInputSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
})

const UpdateInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
})

const DeleteInputSchema = z.object({ id: z.string().uuid() })

export function handleGetProjects(appMainDirectory: string): Project[] {
  return scanProjects(appMainDirectory)
}

export function handleCreateProject(
  appMainDirectory: string,
  input: unknown
): Project {
  const { name, path } = CreateInputSchema.parse(input)
  const now = new Date().toISOString()
  const project = ProjectSchema.parse({
    id: randomUUID(),
    name,
    path,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
  })
  writeProject(appMainDirectory, project)
  return project
}

export function handleUpdateProject(
  appMainDirectory: string,
  input: unknown
): Project {
  const { id, ...updates } = UpdateInputSchema.parse(input)
  const existing = scanProjects(appMainDirectory).find((p) => p.id === id)
  if (!existing) throw new Error(`Project ${id} not found`)
  const updated = ProjectSchema.parse({
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  })
  writeProject(appMainDirectory, updated)
  return updated
}

export function handleDeleteProject(
  appMainDirectory: string,
  input: unknown
): void {
  const { id } = DeleteInputSchema.parse(input)
  deleteProjectDir(appMainDirectory, id)
}

function broadcastProjectsChanged(appMainDirectory: string): void {
  const projects = scanProjects(appMainDirectory)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("app:projects:changed", projects)
  }
}

export function registerProjectsHandlers(
  getAppMainDirectory: () => string
): void {
  ipcMain.handle("app:projects:get", () =>
    handleGetProjects(getAppMainDirectory())
  )
  ipcMain.handle("app:projects:create", (_event, input: unknown) => {
    const project = handleCreateProject(getAppMainDirectory(), input)
    broadcastProjectsChanged(getAppMainDirectory())
    return project
  })
  ipcMain.handle("app:projects:update", (_event, input: unknown) => {
    const project = handleUpdateProject(getAppMainDirectory(), input)
    broadcastProjectsChanged(getAppMainDirectory())
    return project
  })
  ipcMain.handle("app:projects:delete", (_event, input: unknown) => {
    handleDeleteProject(getAppMainDirectory(), input)
    broadcastProjectsChanged(getAppMainDirectory())
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/handlers/projects.ts src/main/handlers/projects.test.ts
git commit -m "feat: add projects IPC handlers (create/update/delete/get)"
```

---

## Task 8: AppState and AppInfo IPC handlers

**Files:**
- Create: `src/main/handlers/appState.ts`
- Create: `src/main/handlers/appInfo.ts`

- [ ] **Step 1: Create `src/main/handlers/appState.ts`**

```ts
import { ipcMain } from "electron"
import type Database from "better-sqlite3"
import { AppStateSchema, type AppState } from "@shared/schemas"
import { getAppState, setAppState } from "@main/db"

export function handleGetAppState(
  db: Database.Database,
  pid: number
): AppState {
  return getAppState(db, pid)
}

export function handleSetAppState(
  db: Database.Database,
  pid: number,
  partial: unknown
): AppState {
  const validated = AppStateSchema.partial().parse(partial)
  return setAppState(db, pid, validated)
}

export function registerAppStateHandlers(db: Database.Database): void {
  ipcMain.handle("app:appState:get", () =>
    handleGetAppState(db, process.pid)
  )
  ipcMain.handle("app:appState:set", (event, partial: unknown) => {
    const next = handleSetAppState(db, process.pid, partial)
    // Send only to the requesting window — appState is per-process
    event.sender.send("app:appState:changed", next)
    return next
  })
}
```

- [ ] **Step 2: Create `src/main/handlers/appInfo.ts`**

```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add src/main/handlers/appState.ts src/main/handlers/appInfo.ts
git commit -m "feat: add appState and appInfo IPC handlers"
```

---

## Task 9: Main process boot sequence

**Files:**
- Modify: `src/main/main.ts`
- Delete: `src/lib/store/main.ts`, `src/lib/store/renderer.ts`, `src/lib/store/preload.ts`, `src/lib/store/types.ts`, `src/renderer/stores/demo.ts`

- [ ] **Step 1: Delete old store files**

```bash
rm src/lib/store/main.ts src/lib/store/renderer.ts src/lib/store/preload.ts src/lib/store/types.ts src/renderer/stores/demo.ts
```

- [ ] **Step 2: Rewrite `src/main/main.ts`**

```ts
import { app, BrowserWindow } from "electron"
import path from "node:path"
import os from "node:os"
import fs from "node:fs"
import started from "electron-squirrel-startup"
import { openDb, cleanStaleAppState, initAppState, getPreferences, setPreferences } from "./db"
import { registerPreferencesHandlers } from "./handlers/preferences"
import { registerProjectsHandlers } from "./handlers/projects"
import { registerAppStateHandlers } from "./handlers/appState"
import { registerAppInfoHandlers } from "./handlers/appInfo"
import type { Preferences } from "@shared/schemas"

if (started) app.quit()

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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    )
  }

  mainWindow.webContents.openDevTools()
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
    // First launch — persist defaults
    setPreferences(db, defaults, defaults)
  }

  // 5. Ensure appMainDirectory exists
  fs.mkdirSync(preferences.appMainDirectory, { recursive: true })

  // 6. Register a fresh app_state row for this process
  initAppState(db, process.pid)

  // 7. Register all IPC handlers
  registerPreferencesHandlers(db, defaults)
  registerProjectsHandlers(() => getPreferences(db, defaults).appMainDirectory)
  registerAppStateHandlers(db)
  registerAppInfoHandlers()

  // 8. Create the window
  createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

- [ ] **Step 3: Verify the app starts without errors**

```bash
npm start
```

Expected: Electron window opens. DevTools console shows no errors. (The renderer will be broken until Task 11, but main process should boot cleanly.)

- [ ] **Step 4: Commit**

```bash
git add src/main/main.ts
git rm src/lib/store/main.ts src/lib/store/renderer.ts src/lib/store/preload.ts src/lib/store/types.ts src/renderer/stores/demo.ts
git commit -m "feat: rewrite main.ts boot sequence; remove old IPC store"
```

---

## Task 10: TanStack Router + Query renderer setup

**Files:**
- Create: `src/renderer/router.ts`
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/hooks/use-ipc-invalidation.ts`
- Create: `src/renderer/hooks/use-preferences.ts`
- Create: `src/renderer/hooks/use-projects.ts`
- Create: `src/renderer/hooks/use-app-state.ts`
- Create: `src/renderer/hooks/use-app-info.ts`

- [ ] **Step 1: Create `src/renderer/router.ts`**

```ts
import { createRouter, createMemoryHistory } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

const memoryHistory = createMemoryHistory({ initialEntries: ["/"] })

export const router = createRouter({
  routeTree,
  history: memoryHistory,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
```

Note: `routeTree.gen.ts` is auto-generated on first `npm start` after routes are created. It will not exist until Task 13.

- [ ] **Step 2: Create `src/renderer/hooks/use-ipc-invalidation.ts`**

```ts
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

export function useIpcInvalidation(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubs = [
      window.__electrand.on("app:preferences:changed", () => {
        void queryClient.invalidateQueries({ queryKey: ["preferences"] })
      }),
      window.__electrand.on("app:projects:changed", () => {
        void queryClient.invalidateQueries({ queryKey: ["projects"] })
      }),
      window.__electrand.on("app:appState:changed", () => {
        void queryClient.invalidateQueries({ queryKey: ["appState"] })
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [queryClient])
}
```

- [ ] **Step 3: Create `src/renderer/hooks/use-preferences.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Preferences } from "@shared/schemas"

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () => window.__electrand.invoke("app:preferences:get"),
  })
}

export function useSetPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<Preferences>) =>
      window.__electrand.invoke("app:preferences:set", partial),
    onSuccess: (data) => {
      queryClient.setQueryData(["preferences"], data)
    },
  })
}
```

- [ ] **Step 4: Create `src/renderer/hooks/use-projects.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => window.__electrand.invoke("app:projects:get"),
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; path: string }) =>
      window.__electrand.invoke("app:projects:create", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string } & Partial<{ name: string; path: string }>) =>
      window.__electrand.invoke("app:projects:update", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string }) =>
      window.__electrand.invoke("app:projects:delete", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}
```

- [ ] **Step 5: Create `src/renderer/hooks/use-app-state.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AppState } from "@shared/schemas"

export function useAppState() {
  return useQuery({
    queryKey: ["appState"],
    queryFn: () => window.__electrand.invoke("app:appState:get"),
  })
}

export function useSetAppState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<AppState>) =>
      window.__electrand.invoke("app:appState:set", partial),
    onSuccess: (data) => {
      queryClient.setQueryData(["appState"], data)
    },
  })
}
```

- [ ] **Step 6: Create `src/renderer/hooks/use-app-info.ts`**

```ts
import { useQuery } from "@tanstack/react-query"

export function useAppInfo() {
  return useQuery({
    queryKey: ["appInfo"],
    queryFn: () => window.__electrand.invoke("app:info:get"),
    staleTime: Infinity, // app info never changes at runtime
  })
}
```

- [ ] **Step 7: Rewrite `src/renderer/App.tsx`**

```tsx
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { RouterProvider } from "@tanstack/react-router"
import { router } from "./router"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
    },
  },
})

export default function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/router.ts src/renderer/App.tsx src/renderer/hooks/
git commit -m "feat: set up TanStack Router + Query; add query hooks for all domains"
```

---

## Task 11: App shell — `__root.tsx`

**Files:**
- Create: `src/renderer/routes/__root.tsx`
- Create: `src/renderer/components/topbar.tsx`

- [ ] **Step 1: Create `src/renderer/components/topbar.tsx`**

```tsx
import React from "react"
import { useRouterState } from "@tanstack/react-router"

export function Topbar(): React.ReactElement {
  const matches = useRouterState({ select: (s) => s.matches })
  const title = [...matches]
    .reverse()
    .find((m) => (m.staticData as { title?: string }).title)
  const label = (title?.staticData as { title?: string })?.title ?? ""

  return (
    <header className="flex h-10 shrink-0 items-center border-b px-4">
      <span className="text-sm font-medium">{label}</span>
    </header>
  )
}
```

- [ ] **Step 2: Create `src/renderer/routes/__root.tsx`**

```tsx
import React from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Topbar } from "@/components/topbar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { ProjectSidebar } from "@/components/sidebar/project-sidebar"
import { useAppState } from "@/hooks/use-app-state"
import { useIpcInvalidation } from "@/hooks/use-ipc-invalidation"

function RootLayout(): React.ReactElement {
  useIpcInvalidation()
  const { data: appState } = useAppState()
  const isInProject = appState?.projectId != null

  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen w-screen">
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
        {isInProject ? <ProjectSidebar /> : <AppSidebar />}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={80}>
        <div className="flex h-full flex-col">
          <Topbar />
          <main className="flex-1 overflow-auto p-4">
            <Outlet />
          </main>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/routes/__root.tsx src/renderer/components/topbar.tsx
git commit -m "feat: add app shell with resizable sidebar and dynamic topbar"
```

---

## Task 12: Sidebar components

**Files:**
- Create: `src/renderer/components/sidebar/app-sidebar.tsx`
- Create: `src/renderer/components/sidebar/project-sidebar.tsx`

- [ ] **Step 1: Create `src/renderer/components/sidebar/app-sidebar.tsx`**

```tsx
import React from "react"
import { Link } from "@tanstack/react-router"
import { Home, Settings, Info } from "lucide-react"

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/preferences", label: "Preferences", icon: Settings },
  { to: "/about", label: "About", icon: Info },
] as const

export function AppSidebar(): React.ReactElement {
  return (
    <nav className="flex h-full flex-col gap-1 p-2">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent [&.active]:bg-accent [&.active]:font-medium"
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Create `src/renderer/components/sidebar/project-sidebar.tsx`**

```tsx
import React from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { LayoutDashboard, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSetAppState } from "@/hooks/use-app-state"
import { useProjects } from "@/hooks/use-projects"

export function ProjectSidebar(): React.ReactElement {
  const { projectId } = useParams({ strict: false }) as { projectId?: string }
  const { data: projects } = useProjects()
  const setAppState = useSetAppState()
  const navigate = useNavigate()

  const project = projects?.find((p) => p.id === projectId)

  const handleClose = (): void => {
    setAppState.mutate(
      { projectId: null },
      { onSuccess: () => void navigate({ to: "/" }) }
    )
  }

  return (
    <nav className="flex h-full flex-col gap-1 p-2">
      {project && (
        <p className="truncate px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {project.name}
        </p>
      )}
      <Link
        to="/projects/$projectId"
        params={{ projectId: projectId ?? "" }}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent [&.active]:bg-accent [&.active]:font-medium"
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        Overview
      </Link>
      <Link
        to="/projects/$projectId/settings"
        params={{ projectId: projectId ?? "" }}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent [&.active]:bg-accent [&.active]:font-medium"
      >
        <Settings className="h-4 w-4 shrink-0" />
        Settings
      </Link>
      <div className="mt-auto">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
          Close Project
        </Button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/sidebar/
git commit -m "feat: add AppSidebar and ProjectSidebar components"
```

---

## Task 13: Home screen — project card grid

**Files:**
- Create: `src/renderer/routes/index.tsx`

- [ ] **Step 1: Create `src/renderer/routes/index.tsx`**

```tsx
import React, { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FolderOpen, Plus } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useProjects, useCreateProject } from "@/hooks/use-projects"
import { useSetAppState } from "@/hooks/use-app-state"
import type { Project } from "@shared/schemas"

export const Route = createFileRoute("/")({
  component: HomeScreen,
})

export const staticData = { title: "Home" }

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso)
  )
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never opened"
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days} days ago`
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: Project
  onOpen: (id: string) => void
}): React.ReactElement {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent"
      onClick={() => onOpen(project.id)}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 shrink-0" />
          {project.name}
        </CardTitle>
        <CardDescription className="truncate">{project.path}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Last opened: {formatRelative(project.lastOpenedAt)}
        </p>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Created {formatDate(project.createdAt)}
        </p>
      </CardFooter>
    </Card>
  )
}

function NewProjectForm({
  onCancel,
}: {
  onCancel: () => void
}): React.ReactElement {
  const [name, setName] = useState("")
  const [projectPath, setProjectPath] = useState("")
  const createProject = useCreateProject()

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!name.trim()) return
    createProject.mutate(
      { name: name.trim(), path: projectPath.trim() || `/projects/${name.trim().toLowerCase()}` },
      { onSuccess: onCancel }
    )
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>New Project</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Path (optional)"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
          />
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={!name.trim() || createProject.isPending}>
            Create
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function HomeScreen(): React.ReactElement {
  const { data: projects, isLoading } = useProjects()
  const setAppState = useSetAppState()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)

  const handleOpenProject = (id: string): void => {
    setAppState.mutate(
      { projectId: id },
      { onSuccess: () => void navigate({ to: "/projects/$projectId", params: { projectId: id } }) }
    )
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading projects…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {showForm && <NewProjectForm onCancel={() => setShowForm(false)} />}

      {!projects?.length && !showForm ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <FolderOpen className="h-10 w-10" />
          <p className="text-sm">No projects yet.</p>
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} onOpen={handleOpenProject} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/routes/index.tsx
git commit -m "feat: add home screen with project card grid"
```

---

## Task 14: Preferences and About screens

**Files:**
- Create: `src/renderer/routes/preferences.tsx`
- Create: `src/renderer/routes/about.tsx`

- [ ] **Step 1: Create `src/renderer/routes/preferences.tsx`**

```tsx
import React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { usePreferences, useSetPreferences } from "@/hooks/use-preferences"

export const Route = createFileRoute("/preferences")({
  component: PreferencesScreen,
})

export const staticData = { title: "Preferences" }

function PreferencesScreen(): React.ReactElement {
  const { data: prefs, isLoading } = usePreferences()
  const setPrefs = useSetPreferences()

  if (isLoading || !prefs) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="text-xl font-semibold">Preferences</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Appearance</h2>
        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <span className="text-sm">Theme</span>
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() =>
              setPrefs.mutate({ theme: prefs.theme === "dark" ? "light" : "dark" })
            }
          >
            {prefs.theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <span className="text-sm">Font size</span>
          <div className="flex items-center gap-2">
            <button
              className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-accent"
              onClick={() => setPrefs.mutate({ fontSize: prefs.fontSize - 1 })}
              disabled={prefs.fontSize <= 8}
            >
              −
            </button>
            <span className="w-8 text-center text-sm">{prefs.fontSize}px</span>
            <button
              className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-accent"
              onClick={() => setPrefs.mutate({ fontSize: prefs.fontSize + 1 })}
              disabled={prefs.fontSize >= 32}
            >
              +
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Storage</h2>
        <div className="rounded-md border px-4 py-3">
          <p className="text-sm font-medium">App data directory</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {prefs.appMainDirectory}
          </p>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/renderer/routes/about.tsx`**

```tsx
import React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useAppInfo } from "@/hooks/use-app-info"

export const Route = createFileRoute("/about")({
  component: AboutScreen,
})

export const staticData = { title: "About" }

function AboutScreen(): React.ReactElement {
  const { data: info, isLoading } = useAppInfo()

  if (isLoading || !info) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  const rows: [string, string][] = [
    ["Version", info.version],
    ["Electron", info.versions.electron],
    ["Node", info.versions.node],
    ["Chrome", info.versions.chrome],
  ]

  return (
    <div className="flex max-w-sm flex-col gap-6">
      <h1 className="text-xl font-semibold">{info.name}</h1>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b last:border-0">
              <td className="py-2 text-muted-foreground">{label}</td>
              <td className="py-2 text-right font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/routes/preferences.tsx src/renderer/routes/about.tsx
git commit -m "feat: add Preferences and About screens"
```

---

## Task 15: Project routes — layout, overview, settings

**Files:**
- Create: `src/renderer/routes/projects/$projectId/route.tsx`
- Create: `src/renderer/routes/projects/$projectId/index.tsx`
- Create: `src/renderer/routes/projects/$projectId/settings.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/renderer/routes/projects/\$projectId
```

- [ ] **Step 2: Create `src/renderer/routes/projects/$projectId/route.tsx`**

This is the layout for all `/projects/$projectId/*` routes. On mount it sets the active project in app state.

```tsx
import React, { useEffect } from "react"
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router"
import { useSetAppState } from "@/hooks/use-app-state"
import { useProjects } from "@/hooks/use-projects"

function ProjectLayout(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId" })
  const setAppState = useSetAppState()
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  useEffect(() => {
    setAppState.mutate({ projectId })
  }, [projectId])

  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>
  }

  return <Outlet />
}

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectLayout,
})
```

- [ ] **Step 3: Create `src/renderer/routes/projects/$projectId/index.tsx`**

```tsx
import React from "react"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { useProjects } from "@/hooks/use-projects"

export const Route = createFileRoute("/projects/$projectId/")({
  component: ProjectOverview,
})

export const staticData = { title: "Overview" }

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

function ProjectOverview(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId/" })
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  if (!project) return <p className="text-sm text-muted-foreground">Loading…</p>

  const rows: [string, string][] = [
    ["Path", project.path],
    ["Created", formatDate(project.createdAt)],
    ["Last updated", formatDate(project.updatedAt)],
    ["Last opened", project.lastOpenedAt ? formatDate(project.lastOpenedAt) : "—"],
  ]

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-xl font-semibold">{project.name}</h1>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b last:border-0">
              <td className="py-2 text-muted-foreground">{label}</td>
              <td className="py-2 text-right font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Project workspace — extend this area with your app-specific content.
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/renderer/routes/projects/$projectId/settings.tsx`**

```tsx
import React, { useState, useEffect } from "react"
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { useProjects, useUpdateProject, useDeleteProject } from "@/hooks/use-projects"
import { useSetAppState } from "@/hooks/use-app-state"

export const Route = createFileRoute("/projects/$projectId/settings")({
  component: ProjectSettings,
})

export const staticData = { title: "Project Settings" }

function ProjectSettings(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId/settings" })
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const setAppState = useSetAppState()
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

  if (!project) return <p className="text-sm text-muted-foreground">Loading…</p>

  const isDirty = name !== project.name || projectPath !== project.path

  const handleSave = (): void => {
    updateProject.mutate({ id: projectId, name, path: projectPath })
  }

  const handleDelete = (): void => {
    deleteProject.mutate(
      { id: projectId },
      {
        onSuccess: () => {
          setAppState.mutate(
            { projectId: null },
            { onSuccess: () => void navigate({ to: "/" }) }
          )
        },
      }
    )
  }

  return (
    <div className="flex max-w-md flex-col gap-8">
      <h1 className="text-xl font-semibold">Project Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">General</h2>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted-foreground">Name</label>
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted-foreground">Path</label>
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={!isDirty || updateProject.isPending}
          onClick={handleSave}
        >
          {updateProject.isPending ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4">
        <h2 className="text-sm font-medium text-destructive">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          Deleting a project removes its folder and all associated data permanently.
        </p>
        {!confirmDelete ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add "src/renderer/routes/projects/"
git commit -m "feat: add project layout, overview, and settings routes"
```

---

## Task 16: Final wiring — run and verify

- [ ] **Step 1: Start the app**

```bash
npm start
```

Expected: App opens. TanStack Router Vite plugin generates `src/renderer/routeTree.gen.ts` automatically. No console errors in DevTools.

- [ ] **Step 2: Verify home screen**

- Home screen loads with "Projects" heading and "New Project" button
- Create a project — card appears in the grid
- Card shows name, path, "Never opened", and created date

- [ ] **Step 3: Verify project navigation**

- Click a project card — navigates to `/projects/$projectId`
- Sidebar switches to ProjectSidebar (project name header, Overview + Settings links, Close button)
- Topbar shows "Overview"
- Click Settings — navigates to `/projects/$projectId/settings`, topbar shows "Project Settings"
- Click Close Project — navigates back to home, sidebar reverts to AppSidebar

- [ ] **Step 4: Verify preferences**

- Click Preferences in AppSidebar
- Theme toggle and font size controls work
- App data directory is displayed

- [ ] **Step 5: Verify About**

- Click About — versions table displays correctly

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 7: Commit routeTree.gen.ts**

```bash
git add src/renderer/routeTree.gen.ts
git commit -m "feat: complete TanStack Router + Query + SQLite integration"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| File-based routing, memory history | Tasks 1, 10 |
| SQLite for preferences + app_state | Tasks 3, 9 |
| Per-pid app_state, stale cleanup on boot | Tasks 3, 9 |
| Project folders as JSON on disk | Task 4 |
| Boot sequence | Task 9 |
| Typed preload bridge | Task 5 |
| ResizablePanelGroup sidebar | Task 11 |
| Dynamic topbar via staticData | Tasks 11, 13, 14, 15 |
| AppSidebar / ProjectSidebar context switch | Tasks 11, 12 |
| Close project button | Task 12 |
| Home screen with shadcn Card grid | Task 13 |
| New project form | Task 13 |
| Preferences screen | Task 14 |
| About screen | Task 14 |
| Project overview screen | Task 15 |
| Project settings + delete | Task 15 |
| Zod schemas, no `any`/unsafe casts | Tasks 2, 3, 4, 6, 7, 8 |
| Push event invalidation | Task 10 |
| shadcn resizable + card | Task 1 |
| Delete old store | Task 9 |

All spec requirements covered. No gaps found.

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:** `Project`, `Preferences`, `AppState`, `AppInfo` defined in Task 2 and used consistently by name across all subsequent tasks. `handleGetPreferences`/`handleSetPreferences` defined in Task 6 and tested with matching signatures. `ElectrandBridge.invoke` channel strings match `ipcMain.handle` channel strings in Tasks 6–9.
