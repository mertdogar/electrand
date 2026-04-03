# Custom Titlebar Design Spec

## Overview

Replace the native OS window frame and current `Topbar` component with a fully custom, VS Code-style titlebar. The titlebar provides window drag, window controls, contextual app/project info, and a settings shortcut.

## Layout

```
[macOS traffic lights / Win controls]  [sidebar trigger] | [center: context title]  [settings gear]
```

- **Left zone (macOS):** Native traffic lights via `titleBarStyle: 'hiddenInset'` + `trafficLightPosition`
- **Left zone (Windows/Linux):** Custom minimize/maximize/close buttons rendered as SVG icons
- **Left zone (all):** Sidebar toggle trigger (moved from current Topbar), separated by a vertical divider
- **Center zone:** Contextual title — "Electrand" on non-project pages, project name when inside a project
- **Right zone:** Settings gear icon button that navigates to the Preferences page
- **Bottom:** Subtle `border-bottom` separator

## BrowserWindow Configuration

In `src/main/main.ts`, update `createWindow`:

```ts
const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  frame: false,
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 12, y: 12 },
  icon: path.join(__dirname, '../../resources/icon.png'),
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
})
```

- `frame: false` removes the native frame on all platforms
- `titleBarStyle: 'hiddenInset'` preserves macOS traffic lights
- `trafficLightPosition` aligns traffic lights vertically within the 40px titlebar

## IPC Handlers

### New file: `src/main/handlers/window.ts`

Registers three handlers on the BrowserWindow instance:

| Channel | Action |
|---|---|
| `app:window:minimize` | `window.minimize()` |
| `app:window:maximize-toggle` | Toggle `window.maximize()` / `window.unmaximize()` |
| `app:window:close` | `window.close()` |

Handler registration signature: `registerWindowHandlers(window: BrowserWindow)` — called in `app.on('ready')` after `createWindow()`.

### Extend existing `AppInfo` with platform

Add `platform` field to `AppInfoSchema` in `src/shared/schemas.ts`. The existing `app:info:get` handler already returns app info — just include `process.platform` in the response. No new handler needed. The renderer already has `useAppInfo()` which will automatically include the platform value.

## Bridge Types

Add to `src/renderer/bridge.ts`:

```ts
// InvokePayloads
"app:window:minimize": void
"app:window:maximize-toggle": void
"app:window:close": void
// InvokeReturns
"app:window:minimize": void
"app:window:maximize-toggle": void
"app:window:close": void
```

## Renderer Components

### New file: `src/renderer/components/titlebar.tsx`

Replaces the current `Topbar` component. Uses Tailwind classes + shadcn `Button`, `Separator` components.

**Structure:**

```tsx
<header className="titlebar">           {/* -webkit-app-region: drag */}
  <div className="left-zone">           {/* no-drag */}
    {platform !== 'darwin' && <WindowControls />}
    <SidebarTrigger />
    <Separator orientation="vertical" />
  </div>
  <div className="center-zone">
    {isInProject ? projectName : 'Electrand'}
  </div>
  <div className="right-zone">          {/* no-drag */}
    <SettingsButton />
  </div>
</header>
```

**Styling (Tailwind + inline styles for Electron-specific properties):**

- Height: `h-10` (40px) — standard titlebar height
- Drag region: Applied via inline `style={{ WebkitAppRegion: 'drag' }}` on the header, `no-drag` on interactive zones
- macOS padding: When `platform === 'darwin'`, add `pl-[80px]` to account for traffic light width
- Border: `border-b` using the existing `border` color variable
- Background: Uses existing `background` theme variable for seamless integration with shadcn theme

### Window Controls sub-component (Windows/Linux only)

Three buttons with SVG icons for minimize, maximize, close:

- Minimize: horizontal line
- Maximize: square outline
- Close: X shape, with red hover background (`hover:bg-destructive`)

Each button calls the corresponding IPC channel via the bridge.

### Settings Button

A ghost `Button` with a `Settings` icon from lucide-react. On click, navigates to `/preferences` using TanStack Router's `useNavigate()`.

### Hook: `src/renderer/hooks/use-window-controls.ts`

Exposes `minimize()`, `maximizeToggle()`, `close()` — thin wrappers around `window.__electrand.invoke(...)`. No React Query needed since these are fire-and-forget actions.

## Root Layout Changes

In `src/renderer/routes/__root.tsx`:

- Remove `<Topbar />` import and usage
- Add `<Titlebar />` as the first child inside `<SidebarInset>`
- The titlebar sits above `<main>` in the flex column layout

## Deleted Files

- `src/renderer/components/topbar.tsx` — fully replaced by the new Titlebar component

## Platform Behavior Summary

| Feature | macOS | Windows/Linux |
|---|---|---|
| Window frame | Hidden (hiddenInset) | Removed (frame: false) |
| Traffic lights | Native, repositioned | N/A |
| Window control buttons | None (use native) | Custom SVG buttons |
| Left padding | 80px (for traffic lights) | Standard |
| Drag region | CSS `-webkit-app-region` | CSS `-webkit-app-region` |

## What This Does NOT Include

- Menu bar system (Alt-key toggled menus from the example) — not needed
- Window icon in titlebar — not needed
- Maximize/restore state tracking — basic toggle is sufficient
- Double-click-to-maximize on titlebar — Electron handles this automatically when drag region is set
