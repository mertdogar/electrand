# TanStack Router + Query Integration Design

**Date:** 2026-03-31
**Status:** Approved

## Overview

Introduce TanStack Router (file-based, memory history) and TanStack Query into the Electron renderer. Replace the existing custom IPC-backed Zustand store with a Query-based data layer. Add a resizable sidebar shell using shadcn's `ResizablePanelGroup`. Store app-level state (preferences, active project per process) in SQLite via `better-sqlite3`. Project data lives on disk as `project.json` per-folder.

---

## Architecture

### Routing

- **Strategy:** File-based routing via `@tanstack/router-plugin` Vite plugin
- **History:** Memory history — no URL bar concerns in Electron, avoids `file://` quirks
- **Route tree:** Auto-generated to `src/renderer/routeTree.gen.ts` — never edited by hand
- **Router instance:** Created in `src/renderer/router.ts`, consumed by `RouterProvider` in `App.tsx`

### Data Layer

The custom `src/lib/store/` system is removed and replaced:

| Concern | Tool |
|---|---|
| Main-process state (preferences, projects, app state) | TanStack Query (`useQuery` + `useMutation`) |
| Cache invalidation on main-process changes | `ipcRenderer.on(event, () => queryClient.invalidateQueries(...))` |
| Local renderer-only UI state | `useState` |

IPC handlers in the main process serve all data. When state changes, main pushes an event to all windows; each window's Query cache is invalidated and refetches.

### Storage

| Data | Storage | Reason |
|---|---|---|
| Preferences | SQLite (`preferences` table, single row) | Shared across processes, no concurrent write conflicts |
| Active project per process | SQLite (`app_state` table, one row per pid) | Multiple instances, concurrent-safe, stale pid cleanup on boot |
| Project metadata | `{appMainDirectory}/{projectId}/project.json` | File-per-project pattern preserves extensibility |

### State Removal

The following files are deleted:
- `src/lib/store/main.ts`
- `src/lib/store/renderer.ts`
- `src/lib/store/preload.ts`
- `src/lib/store/types.ts`
- `src/renderer/stores/demo.ts`

---

## File System Layout

```
~/.local/{appName}/              ← bootstrap directory (fixed, always exists)
├── app.db                       ← SQLite database (preferences + app_state)
├── {project-uuid}/
│   └── project.json
└── {project-uuid}/
    └── project.json
```

`appMainDirectory` in preferences controls where project folders are created. By default it equals `~/.local/{appName}`. Changing it redirects new project creation to the new path on next launch — data migration is out of scope.

### SQLite schema (`app.db`)

```sql
CREATE TABLE IF NOT EXISTS preferences (
  id      INTEGER PRIMARY KEY CHECK (id = 1),  -- enforces single row
  data    TEXT NOT NULL                          -- JSON, validated via PreferencesSchema
);

CREATE TABLE IF NOT EXISTS app_state (
  pid        INTEGER PRIMARY KEY,
  data       TEXT NOT NULL                       -- JSON, validated via AppStateSchema
);
```

Both tables store JSON blobs. Zod validation happens in the main process on every read and write — the DB is a typed store, not a free-form bag.

---

## Boot Sequence

Runs in the main process before the window opens:

1. Resolve `~/.local/{appName}/` — create if missing
2. Open (or create) `app.db` via `better-sqlite3`; run `CREATE TABLE IF NOT EXISTS` migrations
3. Clean stale `app_state` rows: delete any row whose `pid` is not a running process (`process.kill(pid, 0)` throws if dead)
4. Read `preferences` row → `PreferencesSchema.parse()` — insert defaults if missing
5. Resolve `preferences.appMainDirectory` — create directory if missing
6. Scan `appMainDirectory` for subdirectories containing `project.json`
7. For each: `ProjectSchema.safeParse()` — valid entries loaded into memory; invalid ones logged and skipped
8. Insert a fresh `app_state` row for `process.pid` with `{ projectId: null }`
9. State ready — create the BrowserWindow

---

## Source Folder Structure

```
src/
├── shared/
│   └── schemas.ts              # Zod schemas + inferred types (used by main + renderer)
├── main/
│   ├── main.ts                 # App bootstrap, window creation
│   ├── db.ts                   # better-sqlite3 open + migrations
│   ├── handlers/
│   │   ├── preferences.ts      # IPC handlers: app:preferences:*
│   │   ├── projects.ts         # IPC handlers: app:projects:*
│   │   └── appState.ts         # IPC handlers: app:appState:*
│   └── preload.ts              # Exposes typed window.__electrand bridge
└── renderer/
    ├── routes/
    │   ├── __root.tsx           # App shell: ResizablePanelGroup, context-aware sidebar
    │   ├── index.tsx            # / — project list (cards)
    │   ├── preferences.tsx      # /preferences
    │   ├── about.tsx            # /about
    │   └── projects/
    │       └── $projectId/
    │           ├── route.tsx    # Layout: switches sidebar to project nav, provides project context
    │           ├── index.tsx    # /projects/$projectId — project overview
    │           └── settings.tsx # /projects/$projectId/settings
    ├── components/
    │   ├── sidebar/
    │   │   ├── app-sidebar.tsx      # Default nav: Home, Preferences, About
    │   │   └── project-sidebar.tsx  # Project nav: Overview, Settings + Close button
    │   └── topbar.tsx               # Dynamic title via route staticData.title
    ├── routeTree.gen.ts         # Auto-generated — never edit
    ├── router.ts                # createRouter(routeTree, { history: memoryHistory })
    └── App.tsx                  # QueryClientProvider + RouterProvider only
```

---

## Layout Shell

### `__root.tsx` — App shell

`ResizablePanelGroup` (horizontal). The sidebar slot renders either `AppSidebar` or `ProjectSidebar` depending on whether there is an active project in the current window's app state.

```
┌─────────────────────────────────────────────┐
│  ResizablePanelGroup                         │
│  ┌──────────┬──┬────────────────────────────┐│
│  │          │  │  Topbar (dynamic title)    ││
│  │ Sidebar  │▓▓│────────────────────────────││
│  │ Panel    │  │  <Outlet />                ││
│  │ min 15%  │  │  (page content)            ││
│  │ max 30%  │  │                            ││
│  └──────────┴──┴────────────────────────────┘│
└─────────────────────────────────────────────┘
```

- Sidebar panel: `defaultSize={20}` `minSize={15}` `maxSize={30}`
- `ResizableHandle` with `withHandle` prop
- Topbar reads `route.staticData.title` from each route's exported `staticData`

### Sidebar context switching

`__root.tsx` reads `useQuery({ queryKey: ['appState'] })`. If `appState.projectId` is non-null, renders `ProjectSidebar`; otherwise renders `AppSidebar`. No prop drilling — both sidebars query what they need independently.

**`AppSidebar`** — default nav:
- Home (icon + label)
- Preferences
- About

**`ProjectSidebar`** — shown when a project is open:
- Project name (header, truncated)
- Overview link (`/projects/$projectId`)
- Settings link (`/projects/$projectId/settings`)
- Separator
- Close Project button → calls `useMutation(app:appState:set, { projectId: null })` + navigates to `/`

### `projects/$projectId/route.tsx` — Project layout

On mount: calls `useMutation(app:appState:set, { projectId })` to record the active project in SQLite. On unmount (navigating away from all `/projects/*` routes): does nothing — closing is explicit via the sidebar button. Renders `<Outlet />` for sub-routes.

---

## Screens

### Home (`/`)

Project list as a card grid using shadcn `Card`. Each card displays:
- Project name (bold, `CardTitle`)
- Project path (`CardDescription`, truncated)
- Last opened: relative timestamp or "Never opened" (`CardContent`)
- Created at: absolute date (`CardFooter`)

Clicking a card navigates to `/projects/$projectId`.

A "New Project" button opens an inline form (name + path). Submitting calls `useMutation(app:projects:create)` + `invalidateQueries(['projects'])`.

Empty state: centered message with a "Create your first project" prompt.

### Preferences (`/preferences`)

- Theme toggle (dark/light)
- Font size control
- App main directory path (read-only display with a "Change" button — opens native folder picker via `dialog.showOpenDialog` IPC)
- Data fetched via `useQuery({ queryKey: ['preferences'] })`
- Updates via `useMutation(app:preferences:set)` → main writes to SQLite → pushes `app:preferences:changed`

### About (`/about`)

- App name and version
- Electron, Node, Chrome runtime versions
- Single `useQuery({ queryKey: ['appInfo'] })`, no mutations

### Project Overview (`/projects/$projectId`)

- Project name as page heading
- Metadata table: path, created at, last opened at
- Placeholder content area (app developers extend this)

### Project Settings (`/projects/$projectId/settings`)

- Edit project name (inline input + save)
- Edit project path (input + save)
- Danger zone: Delete project button (confirmation required) → `useMutation(app:projects:delete)` → navigate to `/`
- Updates via `useMutation(app:projects:update)`

---

## IPC Contract

### Channels

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `app:preferences:get` | renderer → main | — | `Preferences` |
| `app:preferences:set` | renderer → main | `Partial<Preferences>` | `Preferences` |
| `app:preferences:changed` | main → renderer (push) | `Preferences` | — |
| `app:projects:get` | renderer → main | — | `Project[]` |
| `app:projects:create` | renderer → main | `{ name: string; path: string }` | `Project` |
| `app:projects:update` | renderer → main | `{ id: string } & Partial<{ name: string; path: string }>` | `Project` |
| `app:projects:delete` | renderer → main | `{ id: string }` | `void` |
| `app:projects:changed` | main → renderer (push) | `Project[]` | — |
| `app:appState:get` | renderer → main | — | `AppState` |
| `app:appState:set` | renderer → main | `Partial<AppState>` | `AppState` |
| `app:appState:changed` | main → renderer (push) | `AppState` | — |
| `app:info:get` | renderer → main | — | `AppInfo` |

- `app:projects:create` assigns `id` (uuid), `createdAt`, `updatedAt`, `lastOpenedAt: null` in main
- `app:projects:update` always sets `updatedAt` to current timestamp in main
- `app:appState:*` operates on the row for `process.pid` — each window only sees and writes its own state
- Push events (`*:changed`) are sent to all windows via `BrowserWindow.getAllWindows()`

### Preload bridge

Exposes a typed `window.__electrand` object. The `ElectrandBridge` interface maps every channel to its exact payload and return types — no string-indexed loose typing, no `unknown` without an immediate `.parse()`.

---

## Type Safety & Schemas (`src/shared/schemas.ts`)

```ts
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
  theme: z.enum(['dark', 'light']),
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
  versions: z.object({ electron: z.string(), node: z.string(), chrome: z.string() }),
})
export type AppInfo = z.infer<typeof AppInfoSchema>
```

### Default values (resolved at runtime in main)

```ts
const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  fontSize: 14,
  appMainDirectory: path.join(os.homedir(), '.local', app.getName()),
}

const DEFAULT_APP_STATE: AppState = { projectId: null }
```

### Rules

- No `any`, `never` (except exhaustiveness checks), or unsafe casts (`as Foo`)
- IPC payloads parsed with `.parse()` on the receiving end — validation failures throw, surfacing bugs immediately
- `tsconfig` enforces `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`

---

## Dependencies to Install

```
@tanstack/react-router
@tanstack/router-plugin
@tanstack/react-query
@tanstack/react-query-devtools
zod
better-sqlite3
@types/better-sqlite3
```

shadcn components to add:
```
npx shadcn add resizable card
```

---

## Out of Scope

- Authentication
- Deep-linking / external URL handling
- Persistent sidebar collapse state
- Route-level data loaders
- `appMainDirectory` data migration when path is changed by user
