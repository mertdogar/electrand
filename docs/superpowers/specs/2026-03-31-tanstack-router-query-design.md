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

## IPC Contract

### Channels (main process handlers)

| Channel | Direction | Payload |
|---|---|---|
| `app:preferences:get` | renderer → main | — |
| `app:preferences:set` | renderer → main | `Partial<Preferences>` |
| `app:preferences:changed` | main → renderer | `Preferences` |
| `app:projects:get` | renderer → main | — |
| `app:projects:set` | renderer → main | `Project[]` |
| `app:projects:changed` | main → renderer | `Project[]` |
| `app:info:get` | renderer → main | — |

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
  path: z.string().min(1),
})
export type Project = z.infer<typeof ProjectSchema>

export const PreferencesSchema = z.object({
  theme: z.enum(['dark', 'light']),
  fontSize: z.number().int().min(8).max(32),
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
