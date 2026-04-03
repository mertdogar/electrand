# Custom Titlebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native OS window frame with a custom VS Code-style titlebar featuring window controls, contextual title, sidebar trigger, and settings shortcut.

**Architecture:** Frameless BrowserWindow with CSS drag regions. New IPC handlers for window minimize/maximize/close. A single `Titlebar` React component replaces the existing `Topbar`, reading platform from extended `AppInfo` and project context from existing hooks.

**Tech Stack:** Electron 41 (frameless window), React 19, Tailwind CSS 4, shadcn/ui, TanStack Router, TanStack React Query, lucide-react icons.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/shared/schemas.ts` | Add `platform` field to `AppInfoSchema` |
| Modify | `src/main/handlers/appInfo.ts` | Include `process.platform` in response |
| Create | `src/main/handlers/window.ts` | IPC handlers for minimize/maximize-toggle/close |
| Modify | `src/main/main.ts` | Frameless window config + register window handlers |
| Modify | `src/renderer/bridge.ts` | Add window IPC channel types |
| Create | `src/renderer/hooks/use-window-controls.ts` | Thin wrappers for window control IPC calls |
| Create | `src/renderer/components/titlebar.tsx` | Custom titlebar component |
| Modify | `src/renderer/routes/__root.tsx` | Replace `Topbar` with `Titlebar` |
| Delete | `src/renderer/components/topbar.tsx` | Replaced by titlebar |

---

### Task 1: Extend AppInfo with platform

**Files:**
- Modify: `src/shared/schemas.ts:25-34`
- Modify: `src/main/handlers/appInfo.ts:4-13`
- Modify: `src/renderer/bridge.ts:1` (type import — `AppInfo` type auto-updates via schema)

- [ ] **Step 1: Add platform to AppInfoSchema**

In `src/shared/schemas.ts`, update the `AppInfoSchema`:

```ts
export const AppInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  platform: z.string().min(1),
  versions: z.object({
    electron: z.string().min(1),
    node: z.string().min(1),
    chrome: z.string().min(1),
  }),
})
```

- [ ] **Step 2: Include platform in handler response**

In `src/main/handlers/appInfo.ts`, update `getAppInfo()`:

```ts
export function getAppInfo(): AppInfo {
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
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/schemas.ts src/main/handlers/appInfo.ts
git commit -m "feat: add platform field to AppInfo schema"
```

---

### Task 2: Add window IPC handlers

**Files:**
- Create: `src/main/handlers/window.ts`
- Modify: `src/main/main.ts:1,29-48,77-82`
- Modify: `src/renderer/bridge.ts:3-13,15-25`

- [ ] **Step 1: Create window handler file**

Create `src/main/handlers/window.ts`:

```ts
import { ipcMain, type BrowserWindow } from "electron"

export function registerWindowHandlers(window: BrowserWindow): void {
  ipcMain.handle("app:window:minimize", () => {
    window.minimize()
  })

  ipcMain.handle("app:window:maximize-toggle", () => {
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  ipcMain.handle("app:window:close", () => {
    window.close()
  })
}
```

- [ ] **Step 2: Add bridge types**

In `src/renderer/bridge.ts`, add the three new channels to `InvokePayloads`:

```ts
export interface InvokePayloads {
  "app:preferences:get": void
  "app:preferences:set": Partial<Preferences>
  "app:projects:get": void
  "app:projects:create": { name: string; path: string }
  "app:projects:update": { id: string } & Partial<{ name: string; path: string }>
  "app:projects:delete": { id: string }
  "app:appState:get": void
  "app:appState:set": Partial<AppState>
  "app:info:get": void
  "app:window:minimize": void
  "app:window:maximize-toggle": void
  "app:window:close": void
}
```

And to `InvokeReturns`:

```ts
export interface InvokeReturns {
  "app:preferences:get": Preferences
  "app:preferences:set": Preferences
  "app:projects:get": Project[]
  "app:projects:create": Project
  "app:projects:update": Project
  "app:projects:delete": void
  "app:appState:get": AppState
  "app:appState:set": AppState
  "app:info:get": AppInfo
  "app:window:minimize": void
  "app:window:maximize-toggle": void
  "app:window:close": void
}
```

- [ ] **Step 3: Update main process to use frameless window and register handlers**

In `src/main/main.ts`, add the import at the top:

```ts
import { registerWindowHandlers } from "./handlers/window"
```

Update `createWindow` to return a frameless window:

```ts
const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    icon: path.join(__dirname, "../../resources/icon.png"),
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
```

In `app.on('ready')`, register window handlers after creating the window. Change the end of the callback:

```ts
  // 8. Create the window
  const mainWindow = createWindow()

  // 9. Register window control handlers
  registerWindowHandlers(mainWindow)
```

- [ ] **Step 4: Commit**

```bash
git add src/main/handlers/window.ts src/main/main.ts src/renderer/bridge.ts
git commit -m "feat: add frameless window config and window control IPC handlers"
```

---

### Task 3: Create window controls hook

**Files:**
- Create: `src/renderer/hooks/use-window-controls.ts`

- [ ] **Step 1: Create the hook**

Create `src/renderer/hooks/use-window-controls.ts`:

```ts
export function useWindowControls() {
  return {
    minimize: () => window.__electrand.invoke("app:window:minimize"),
    maximizeToggle: () => window.__electrand.invoke("app:window:maximize-toggle"),
    close: () => window.__electrand.invoke("app:window:close"),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/hooks/use-window-controls.ts
git commit -m "feat: add useWindowControls hook"
```

---

### Task 4: Create Titlebar component and wire into layout

**Files:**
- Create: `src/renderer/components/titlebar.tsx`
- Modify: `src/renderer/routes/__root.tsx:1-35`
- Delete: `src/renderer/components/topbar.tsx`

- [ ] **Step 1: Create the Titlebar component**

Create `src/renderer/components/titlebar.tsx`:

```tsx
import React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Settings, Minus, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAppInfo } from "@/hooks/use-app-info"
import { useAppState } from "@/hooks/use-app-state"
import { useProjects } from "@/hooks/use-projects"
import { useWindowControls } from "@/hooks/use-window-controls"

export function Titlebar(): React.ReactElement {
  const { data: appInfo } = useAppInfo()
  const { data: appState } = useAppState()
  const { data: projects } = useProjects()
  const { minimize, maximizeToggle, close } = useWindowControls()
  const navigate = useNavigate()

  const platform = appInfo?.platform ?? ""
  const isDarwin = platform === "darwin"

  const project = appState?.projectId
    ? projects?.find((p) => p.id === appState.projectId)
    : null
  const centerTitle = project?.name ?? "Electrand"

  return (
    <header
      className="flex h-10 shrink-0 items-center border-b px-2"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left zone */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {!isDarwin && <WindowControls minimize={minimize} maximizeToggle={maximizeToggle} close={close} />}
        <SidebarTrigger className={isDarwin ? "ml-[70px]" : ""} />
        <Separator orientation="vertical" className="h-4" />
      </div>

      {/* Center zone */}
      <div className="flex-1 text-center text-sm font-medium select-none">
        {centerTitle}
      </div>

      {/* Right zone */}
      <div
        className="flex items-center"
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

- [ ] **Step 2: Update root layout to use Titlebar**

Replace the full content of `src/renderer/routes/__root.tsx`:

```tsx
import React, { useEffect } from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Titlebar } from "@/components/titlebar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { ProjectSidebar } from "@/components/sidebar/project-sidebar"
import { useAppState } from "@/hooks/use-app-state"
import { useIpcInvalidation } from "@/hooks/use-ipc-invalidation"
import { usePreferences } from "@/hooks/use-preferences"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { CommandPalette } from "@/components/command-palette"

function RootLayout(): React.ReactElement {
  useIpcInvalidation()
  const { data: appState } = useAppState()
  const { data: prefs } = usePreferences()
  const isInProject = appState?.projectId != null

  useEffect(() => {
    if (!prefs) return
    document.documentElement.classList.toggle("dark", prefs.theme === "dark")
  }, [prefs?.theme])

  return (
    <SidebarProvider>
      {isInProject ? <ProjectSidebar /> : <AppSidebar />}
      <SidebarInset>
        <Titlebar />
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

- [ ] **Step 3: Delete the old Topbar**

```bash
rm src/renderer/components/topbar.tsx
```

Verify no other files import it:

```bash
grep -r "topbar" src/renderer/ --include="*.tsx" --include="*.ts"
```

Expected: No results (only the deleted file referenced it from `__root.tsx`, which is now updated).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/titlebar.tsx src/renderer/routes/__root.tsx
git rm src/renderer/components/topbar.tsx
git commit -m "feat: replace Topbar with custom Titlebar component"
```

---

### Task 5: Verify and adjust

- [ ] **Step 1: Start the app**

```bash
npm start
```

Verify:
- On macOS: native traffic lights visible in top-left, sidebar trigger to their right, "Electrand" centered, settings gear on right
- Titlebar is draggable (click and drag to move window)
- Sidebar trigger, settings gear, and window controls are clickable (not intercepted by drag)
- Settings gear navigates to `/preferences`
- Border visible at bottom of titlebar

- [ ] **Step 2: Test project context**

Navigate into a project. Verify the center title changes from "Electrand" to the project name.

- [ ] **Step 3: Test window controls (Windows/Linux only)**

If on Windows/Linux, verify minimize, maximize/restore, and close buttons work. Close button should have red hover state.

- [ ] **Step 4: Final commit if any adjustments were needed**

If any tweaks were made during verification:

```bash
git add -A
git commit -m "fix: adjust titlebar styling after visual verification"
```
