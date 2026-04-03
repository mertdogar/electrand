# electron-trpc Migration Design Spec

## Overview

Replace the entire hand-rolled IPC layer (bridge types, preload, handlers, React hooks) with `electron-trpc-experimental`. The renderer uses `@trpc/react-query` which wraps React Query, maintaining the same caching/refetching behavior but with end-to-end type safety derived from the router definition — no manually maintained `InvokePayloads`/`InvokeReturns` interfaces.

## Architecture

### Router Shape

```
appRouter
├── preferences
│   ├── get        (query)
│   ├── set        (mutation)
│   └── onChange   (subscription → invalidation signal)
├── projects
│   ├── list       (query)
│   ├── create     (mutation)
│   ├── update     (mutation)
│   ├── delete     (mutation)
│   └── onChange   (subscription → invalidation signal)
├── appState
│   ├── get        (query)
│   ├── set        (mutation)
│   └── onChange   (subscription → invalidation signal)
├── appInfo
│   └── get        (query)
└── window
    ├── minimize       (mutation)
    ├── maximizeToggle (mutation)
    ├── close          (mutation)
    └── selectDirectory (mutation)
```

### Data Flow

1. Renderer calls `trpc.projects.create.useMutation()`
2. electron-trpc sends via IPC to main process
3. Main process router handler creates the project, emits to EventEmitter
4. Subscription listener picks up the event, pushes `"invalidate"` to all subscribers
5. Renderer subscription callback calls `utils.projects.list.invalidate()`
6. React Query refetches via `trpc.projects.list.useQuery()`

### Key Design Decisions

- **Invalidation signals over full data push:** Subscriptions emit `"invalidate"` strings, not full payloads. The renderer refetches through tRPC queries. Keeps the existing pattern, avoids duplicating data serialization logic.
- **Closure-based dependency injection:** Each sub-router is created via a factory function that receives its dependencies (db, BrowserWindow, etc.). No tRPC context object needed.
- **Broader appState broadcast accepted:** All windows receive `appState:changed` invalidation. Since appState is keyed by PID, each window refetches its own state. The extra refetch is harmless (cheap SQLite lookup).
- **Shared EventEmitter:** A single `EventEmitter` instance in `src/main/trpc.ts` coordinates mutation → subscription signaling across all routers.

## Channel Migration Map

| Current Channel | Type | tRPC Procedure | Notes |
|---|---|---|---|
| `app:preferences:get` | invoke | `preferences.get` (query) | |
| `app:preferences:set` | invoke | `preferences.set` (mutation) | Emits `ee.emit("preferences:changed")` |
| `app:preferences:changed` | broadcast | `preferences.onChange` (subscription) | Invalidates `preferences.get` |
| `app:projects:get` | invoke | `projects.list` (query) | |
| `app:projects:create` | invoke | `projects.create` (mutation) | Emits `ee.emit("projects:changed")` |
| `app:projects:update` | invoke | `projects.update` (mutation) | Emits `ee.emit("projects:changed")` |
| `app:projects:delete` | invoke | `projects.delete` (mutation) | Emits `ee.emit("projects:changed")` |
| `app:projects:changed` | broadcast | `projects.onChange` (subscription) | Invalidates `projects.list` |
| `app:appState:get` | invoke | `appState.get` (query) | |
| `app:appState:set` | invoke | `appState.set` (mutation) | Emits `ee.emit("appState:changed")` |
| `app:appState:changed` | broadcast | `appState.onChange` (subscription) | Invalidates `appState.get` |
| `app:info:get` | invoke | `appInfo.get` (query) | No subscription (static data) |
| `app:window:minimize` | invoke | `window.minimize` (mutation) | Fire-and-forget |
| `app:window:maximize-toggle` | invoke | `window.maximizeToggle` (mutation) | Fire-and-forget |
| `app:window:close` | invoke | `window.close` (mutation) | Fire-and-forget |
| `app:dialog:select-directory` | invoke | `window.selectDirectory` (mutation) | Returns `string \| null` |

16 channels → 16 tRPC procedures + 3 subscriptions.

## Main Process

### `src/main/trpc.ts` — tRPC initialization

```ts
import { initTRPC } from "@trpc/server"
import { EventEmitter } from "events"

export const ee = new EventEmitter()

const t = initTRPC.create({ isServer: true })

export const router = t.router
export const publicProcedure = t.procedure
```

### `src/main/routers/preferences.ts`

Factory function receives `db` and `defaults`. Defines `get` (query), `set` (mutation that emits `"preferences:changed"`), and `onChange` (subscription that listens for `"preferences:changed"` and emits `"invalidate"`).

Input validation for `set` uses a Zod partial schema matching `PreferencesSchema`.

### `src/main/routers/projects.ts`

Factory function receives `getAppMainDirectory`. Defines `list` (query), `create`/`update`/`delete` (mutations that emit `"projects:changed"`), and `onChange` (subscription).

Reuses existing pure functions from `src/main/projects.ts` (scanProjects, writeProject, deleteProjectDir, readProject). Input validation schemas (CreateInputSchema, UpdateInputSchema, DeleteInputSchema) move into the router file as tRPC `.input()` validators.

### `src/main/routers/appState.ts`

Factory function receives `db` and `getAppMainDirectory`. Defines `get` (query), `set` (mutation that updates lastOpenedAt on project open, emits `"appState:changed"`), and `onChange` (subscription).

### `src/main/routers/appInfo.ts`

No factory deps needed. Single `get` query returning app name, version, platform, and process versions. No subscription needed — data is static at runtime.

### `src/main/routers/window.ts`

Factory function receives `BrowserWindow`. Defines `minimize`, `maximizeToggle`, `close` (fire-and-forget mutations), and `selectDirectory` (mutation returning `string | null`).

### `src/main/router.ts` — merged router

```ts
export function createAppRouter(deps: {
  db: Database
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

### `src/main/main.ts` — wiring

Replace all `registerXxxHandlers()` calls with:

```ts
import { createIPCHandler } from "electron-trpc-experimental/main"
import { createAppRouter } from "./router"

// In app.on("ready"):
const mainWindow = createWindow()
const appRouter = createAppRouter({ db, defaults, mainWindow, getAppMainDirectory })
createIPCHandler({ router: appRouter, windows: [mainWindow] })
```

## Preload

### `src/renderer/preload.ts`

```ts
import { exposeElectronTRPC } from "electron-trpc-experimental/preload"

process.once("loaded", () => {
  exposeElectronTRPC()
})
```

Replaces the hand-rolled `contextBridge.exposeInMainWorld("__electrand", bridge)`. The library exposes `window.electronTRPC` internally.

## Renderer

### `src/renderer/trpc.ts` — client setup

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

### `src/renderer/App.tsx` — provider wrapping

Wrap existing `QueryClientProvider` with `trpc.Provider`:

```tsx
const queryClient = new QueryClient({ /* existing config */ })
const trpcClient = createTRPCClient()

export default function App() {
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

### Invalidation subscriptions — in `__root.tsx`

Replaces `useIpcInvalidation()`:

```tsx
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
```

### Component migration

All custom hooks are replaced by direct tRPC hook calls:

| Before | After |
|---|---|
| `useProjects()` | `trpc.projects.list.useQuery()` |
| `useCreateProject()` | `trpc.projects.create.useMutation()` |
| `useUpdateProject()` | `trpc.projects.update.useMutation()` |
| `useDeleteProject()` | `trpc.projects.delete.useMutation()` |
| `usePreferences()` | `trpc.preferences.get.useQuery()` |
| `useSetPreferences()` | `trpc.preferences.set.useMutation()` |
| `useAppState()` | `trpc.appState.get.useQuery()` |
| `useSetAppState()` | `trpc.appState.set.useMutation()` |
| `useAppInfo()` | `trpc.appInfo.get.useQuery()` |
| `useWindowControls().minimize()` | `trpc.window.minimize.useMutation()` then `.mutate()` |
| `window.__electrand.invoke("app:dialog:select-directory")` | `trpc.window.selectDirectory.useMutation()` then `.mutateAsync()` |

### Consumer files to update

1. `src/renderer/components/titlebar.tsx` — useAppInfo, useAppState, useProjects, useWindowControls
2. `src/renderer/components/sidebar/project-sidebar.tsx` — useSetAppState, useProjects
3. `src/renderer/components/command-palette.tsx` — useProjects, usePreferences, useSetPreferences, useSetAppState
4. `src/renderer/routes/__root.tsx` — useAppState, useIpcInvalidation, usePreferences
5. `src/renderer/routes/index.tsx` — useProjects, useCreateProject, useSetAppState
6. `src/renderer/routes/about.tsx` — useAppInfo
7. `src/renderer/routes/preferences.tsx` — usePreferences, useSetPreferences, window.__electrand.invoke
8. `src/renderer/routes/projects/$projectId/route.tsx` — useSetAppState, useProjects
9. `src/renderer/routes/projects/$projectId/index.tsx` — useProjects
10. `src/renderer/routes/projects/$projectId/settings.tsx` — useProjects, useUpdateProject, useDeleteProject, useSetAppState

## File Map

| Action | Path |
|---|---|
| Create | `src/main/trpc.ts` |
| Create | `src/main/router.ts` |
| Create | `src/main/routers/preferences.ts` |
| Create | `src/main/routers/projects.ts` |
| Create | `src/main/routers/appState.ts` |
| Create | `src/main/routers/appInfo.ts` |
| Create | `src/main/routers/window.ts` |
| Create | `src/renderer/trpc.ts` |
| Modify | `src/renderer/preload.ts` |
| Modify | `src/renderer/App.tsx` |
| Modify | `src/renderer/routes/__root.tsx` |
| Modify | `src/main/main.ts` |
| Modify | `src/renderer/components/titlebar.tsx` |
| Modify | `src/renderer/components/sidebar/project-sidebar.tsx` |
| Modify | `src/renderer/components/command-palette.tsx` |
| Modify | `src/renderer/routes/index.tsx` |
| Modify | `src/renderer/routes/about.tsx` |
| Modify | `src/renderer/routes/preferences.tsx` |
| Modify | `src/renderer/routes/projects/$projectId/route.tsx` |
| Modify | `src/renderer/routes/projects/$projectId/index.tsx` |
| Modify | `src/renderer/routes/projects/$projectId/settings.tsx` |
| Delete | `src/renderer/bridge.ts` |
| Delete | `src/renderer/hooks/use-projects.ts` |
| Delete | `src/renderer/hooks/use-preferences.ts` |
| Delete | `src/renderer/hooks/use-app-state.ts` |
| Delete | `src/renderer/hooks/use-app-info.ts` |
| Delete | `src/renderer/hooks/use-window-controls.ts` |
| Delete | `src/renderer/hooks/use-ipc-invalidation.ts` |
| Delete | `src/main/handlers/preferences.ts` |
| Delete | `src/main/handlers/projects.ts` |
| Delete | `src/main/handlers/appState.ts` |
| Delete | `src/main/handlers/appInfo.ts` |
| Delete | `src/main/handlers/window.ts` |

## Dependencies

**Install:**
- `@trpc/server@^11`
- `@trpc/client@^11`
- `@trpc/react-query@^11`

**Zod v4 compatibility note:** The project uses `zod@^4.3.6`. tRPC v11 supports Standard Schema interface. Zod v4 implements Standard Schema, so input validation should work. If any build issues arise, the fallback is importing from `zod/v4` or using `zod@^3` alongside. This is a build-time verification during implementation.

## Preserved Code

The following files are NOT touched — they contain pure business logic reused by the new routers:

- `src/main/db.ts` — SQLite operations (getPreferences, setPreferences, getAppState, setAppState, etc.)
- `src/main/projects.ts` — Filesystem operations (scanProjects, writeProject, deleteProjectDir, readProject)
- `src/shared/schemas.ts` — Zod schema definitions (shared types remain the single source of truth)

## What This Does NOT Include

- SuperJSON transformer — not needed since all data is plain JSON-serializable (strings, numbers, arrays)
- tRPC middleware — no auth or logging middleware needed for a local desktop app
- tRPC context — dependencies injected via closures, not context
- Error formatting — tRPC's default error handling is sufficient; Zod validation errors propagate automatically
