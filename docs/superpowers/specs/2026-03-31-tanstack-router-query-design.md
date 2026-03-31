# TanStack Router + Query Integration Design

**Date:** 2026-03-31
**Status:** Approved

## Overview

Introduce TanStack Router (file-based, memory history) and TanStack Query into the Electron renderer. Replace the existing custom IPC-backed Zustand store with a Query-based data layer. Add a resizable sidebar shell using shadcn's `ResizablePanelGroup`.

---

## Architecture

### Routing

- **Strategy:** File-based routing via `@tanstack/router-plugin` Vite plugin
- **History:** Memory history — no URL bar concerns in Electron, avoids `file://` quirks
- **Route tree:** Auto-generated to `src/renderer/routeTree.gen.ts` — never edited by hand
- **Router instance:** Created in `src/renderer/router.ts`, consumed by `RouterProvider` in `App.tsx`

### Data Layer

The custom `src/lib/store/` system (main store, renderer hook, preload bridge) is removed and replaced:

| Concern | Tool |
|---|---|
| Main-process state (preferences, projects, app info) | TanStack Query (`useQuery` + `useMutation`) |
| Cache invalidation on main-process changes | `ipcRenderer.on(event, () => queryClient.invalidateQueries(...))` |
| Local renderer-only UI state | `useState` |

IPC handlers in the main process replace the zustand-based store. Each domain (preferences, projects, appInfo) gets a `get` handler and a `set` handler. When state changes in main, it emits an IPC event to all windows; each window's Query cache is invalidated and refetched.

### State Removal

The following files are deleted:
- `src/lib/store/main.ts`
- `src/lib/store/renderer.ts`
- `src/lib/store/preload.ts`
- `src/lib/store/types.ts`
- `src/renderer/stores/demo.ts`

---

## Folder Structure

```
src/renderer/
├── routes/
│   ├── __root.tsx          # Root layout: ResizablePanelGroup + topbar + <Outlet />
│   ├── index.tsx           # Home screen (path: /)
│   ├── preferences.tsx     # Preferences screen (path: /preferences)
│   └── about.tsx           # About screen (path: /about)
├── components/
│   ├── sidebar.tsx         # Nav links using <Link> from TanStack Router
│   └── topbar.tsx          # Dynamic title via route staticData.title
├── routeTree.gen.ts        # Auto-generated — do not edit
├── router.ts               # createRouter(routeTree, { history: memoryHistory })
└── App.tsx                 # QueryClientProvider + RouterProvider only
```

---

## Layout Shell (`__root.tsx`)

Uses shadcn `ResizablePanelGroup` (direction: horizontal):

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
- `ResizableHandle` with `withHandle` prop for visible drag affordance
- Main panel: fills remaining space; stacks topbar + `<Outlet />`
- Topbar reads `route.staticData.title` — each route exports `export const staticData = { title: '...' }`

---

## Screens

### Home (`/`)
- Displays projects list
- Data fetched via `useQuery({ queryKey: ['projects'] })` — IPC handler returns stored projects array
- Add/remove project via `useMutation` + `invalidateQueries(['projects'])`

### Preferences (`/preferences`)
- Theme toggle (dark/light) and font size control
- Data fetched via `useQuery({ queryKey: ['preferences'] })`
- Updates via `useMutation` → IPC set handler → main emits change event → cache invalidated

### About (`/about`)
- Displays app name, version, and runtime versions (Electron, Node, Chrome)
- Single `useQuery({ queryKey: ['appInfo'] })` — main returns `app.getVersion()` + `process.versions`
- No mutations needed

---

## File System Layout

```
~/.local/{appName}/              ← appMainDirectory (default)
├── preferences.json             ← Preferences (always at this fixed bootstrap path)
├── {project-uuid}/
│   └── project.json             ← Project
└── {project-uuid}/
    └── project.json
```

**Bootstrap note:** `preferences.json` always lives at `~/.local/{appName}/preferences.json` — this path is fixed and never moves, so the app can always find it. The `appMainDirectory` preference controls where **project folders** are stored. By default it equals `~/.local/{appName}`, but if changed by the user, new projects are created under the new path on next launch. Data migration is out of scope.

---

## Boot Sequence

Runs entirely in the main process before the window is ready to receive IPC calls:

1. Resolve bootstrap path: `~/.local/{appName}/` — create if missing
2. Read `preferences.json` → `PreferencesSchema.parse()` — write defaults if missing or invalid
3. Read `preferences.appMainDirectory` — create if missing
4. Scan `appMainDirectory` for subdirectories containing `project.json`
5. For each: `ProjectSchema.safeParse()` — valid entries are loaded into memory; invalid ones are logged and skipped (no crash)
6. State is ready in memory; window is created
7. Renderer IPC calls are served from in-memory state; mutations write through to disk

---

## IPC Contract

### Channels (main process handlers)

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `app:preferences:get` | renderer → main | — | `Preferences` |
| `app:preferences:set` | renderer → main | `Partial<Preferences>` | `Preferences` |
| `app:preferences:changed` | main → renderer (push) | `Preferences` | — |
| `app:projects:get` | renderer → main | — | `Project[]` |
| `app:projects:create` | renderer → main | `Omit<Project, 'id' \| 'createdAt' \| 'updatedAt' \| 'lastOpenedAt'>` | `Project` |
| `app:projects:update` | renderer → main | `Pick<Project, 'id'> & Partial<Omit<Project, 'id' \| 'createdAt'>>` | `Project` |
| `app:projects:delete` | renderer → main | `{ id: string }` | `void` |
| `app:projects:changed` | main → renderer (push) | `Project[]` | — |
| `app:info:get` | renderer → main | — | `AppInfo` |

`create` assigns `id` (uuid), `createdAt`, `updatedAt`, and `lastOpenedAt: null` in main.
`update` always sets `updatedAt` to the current timestamp in main.

### Preload bridge

The preload script exposes a typed `window.__electrand` object with `invoke` and `on` methods. Renderer code never calls `ipcRenderer` directly.

---

## Type Safety

All domain objects are defined as Zod schemas. TypeScript types are derived from schemas via `z.infer<>` — no standalone interfaces for data that crosses IPC boundaries.

### Schemas (live in `src/shared/schemas.ts`, imported by both main and renderer)

```ts
// src/shared/schemas.ts
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  path: z.string().min(1),            // user-facing project path (workspace root, etc.)
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime().nullable(),
})
export type Project = z.infer<typeof ProjectSchema>

export const PreferencesSchema = z.object({
  theme: z.enum(['dark', 'light']),
  fontSize: z.number().int().min(8).max(32),
  appMainDirectory: z.string().min(1), // default: ~/.local/{appName}
})
export type Preferences = z.infer<typeof PreferencesSchema>

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

### Default values (computed at runtime in main)

```ts
const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  fontSize: 14,
  appMainDirectory: path.join(os.homedir(), '.local', app.getName()),
}
```

### Rules

- No `any`, `never` (except exhaustiveness checks), or unsafe type casts (`as Foo`) anywhere in the codebase
- IPC payloads are parsed with `.parse()` on the **receiving** end (main parses renderer input; renderer parses main responses) — if validation fails it throws, which surfaces bugs rather than silently corrupting state
- The preload bridge's `invoke` and `on` methods are fully typed via a `ElectrandBridge` interface that maps channel names to their payload/return types — no string-indexed loose typing
- `tsconfig` enforces `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`

---

## Dependencies to Install

```
@tanstack/react-router
@tanstack/router-plugin
@tanstack/react-query
@tanstack/react-query-devtools
zod
```

shadcn component to add:
```
npx shadcn add resizable
```

---

## Out of Scope

- Authentication
- Deep-linking / external URL handling
- Persistent sidebar collapse state (can be added later via preferences store)
- Route-level data loaders (TanStack Router loaders) — mutations + query invalidation is sufficient for this scale
