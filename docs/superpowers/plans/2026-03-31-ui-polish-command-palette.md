# UI Polish & Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace amateur-looking bordered forms/cards with an elevated shadow style, and add a full-power Cmd+K command palette for navigation, project actions, and settings.

**Architecture:** Two independent changes. (1) Update the shadcn `Input` component base classes to use soft shadow instead of hard border, then swap all raw `<input>` tags for the `Input` component. (2) Install shadcn `Command` component (wraps `cmdk`), create a `CommandPalette` component rendered in the root layout with a global Cmd+K listener.

**Tech Stack:** React 19, shadcn/ui (new-york style), cmdk, Tailwind CSS 4, TanStack Router, TanStack Query, Lucide icons.

---

### Task 1: Update Input component to elevated style

**Files:**

- Modify: `src/renderer/components/ui/input.tsx`

- [ ] **Step 1: Update Input base classes**

Replace the current hard-border style with a softer elevated look. Open `src/renderer/components/ui/input.tsx` and replace the className string:

```tsx
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-border/40 bg-card px-3 py-1 text-base shadow-sm transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  )
}
```

Key changes from original:

- `border-input` → `border-border/40` (much softer border)
- `bg-transparent` → `bg-card` (white background that lifts off page)
- `shadow-xs` → `shadow-sm` (subtle elevation)
- Removed `dark:bg-input/30`

- [ ] **Step 2: Verify the app builds**

Run: `cd /Users/mertdogar/Workspace/personal/electrand && npm run start`

Verify the app starts without errors. Check that existing inputs on the Preferences and Settings pages render with the new softer style.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ui/input.tsx
git commit -m "style: update Input component to elevated shadow style"
```

---

### Task 2: Replace raw inputs in Home screen (New Project form)

**Files:**

- Modify: `src/renderer/routes/index.tsx`

- [ ] **Step 1: Add Input import and replace raw inputs**

In `src/renderer/routes/index.tsx`, add `Input` to the imports and replace the raw `<input>` elements in `NewProjectForm`:

Add to imports at the top:

```tsx
import { Input } from "@/components/ui/input"
```

Replace the `NewProjectForm` component's `CardContent` section. Change:

```tsx
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
```

To:

```tsx
<CardContent className="flex flex-col gap-3">
  <Input
    placeholder="Project name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    autoFocus
  />
  <Input
    placeholder="Path (optional)"
    value={projectPath}
    onChange={(e) => setProjectPath(e.target.value)}
  />
</CardContent>
```

- [ ] **Step 2: Add hover elevation to ProjectCard**

In the same file, update the `ProjectCard` component's `Card` className. Change:

```tsx
<Card
  className="cursor-pointer transition-colors hover:bg-accent"
  onClick={() => onOpen(project.id)}
>
```

To:

```tsx
<Card
  className="cursor-pointer transition-shadow hover:shadow-md"
  onClick={() => onOpen(project.id)}
>
```

- [ ] **Step 3: Verify the app builds and the Home screen looks correct**

Run: `cd /Users/mertdogar/Workspace/personal/electrand && npm run start`

Verify:

- New Project form inputs have the soft shadow style (no harsh border ring)
- Project cards elevate on hover with a shadow transition
- Create/Cancel buttons still work

- [ ] **Step 4: Commit**

```bash
git add src/renderer/routes/index.tsx
git commit -m "style: use Input component and hover shadow on Home screen"
```

---

### Task 3: Replace raw inputs in Project Settings

**Files:**

- Modify: `src/renderer/routes/projects/$projectId/settings.tsx`

- [ ] **Step 1: Add Input and Card imports, replace raw inputs**

In `src/renderer/routes/projects/$projectId/settings.tsx`, add imports:

```tsx
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
```

Replace the two raw `<input>` elements in the General section. Change:

```tsx
<input
  id="project-name"
  className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

To:

```tsx
<Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
```

And change:

```tsx
<input
  id="project-path"
  className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
  value={projectPath}
  onChange={(e) => setProjectPath(e.target.value)}
/>
```

To:

```tsx
<Input id="project-path" value={projectPath} onChange={(e) => setProjectPath(e.target.value)} />
```

- [ ] **Step 2: Wrap danger zone in a Card**

Replace the danger zone `PageSection`. Change:

```tsx
<PageSection className="rounded-md border border-destructive/40 p-4">
  <h2 className="text-sm font-medium text-destructive">Danger Zone</h2>
```

To:

```tsx
<Card className="border-destructive/40">
  <CardHeader>
    <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-3">
```

And close the Card properly. The full danger zone becomes:

```tsx
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
```

- [ ] **Step 3: Verify the settings page**

Run: `cd /Users/mertdogar/Workspace/personal/electrand && npm run start`

Navigate to a project's settings page. Verify:

- Name and Path inputs use the new elevated style
- Danger zone is wrapped in a Card with a subtle destructive border
- Save and Delete buttons still work

- [ ] **Step 4: Commit**

```bash
git add src/renderer/routes/projects/\$projectId/settings.tsx
git commit -m "style: use Input component and Card in Project Settings"
```

---

### Task 4: Update Preferences page styling

**Files:**

- Modify: `src/renderer/routes/preferences.tsx`

- [ ] **Step 1: Replace inline border wrappers with Card components**

In `src/renderer/routes/preferences.tsx`, add Card imports:

```tsx
import { Card, CardContent } from "@/components/ui/card"
```

Replace the Appearance section's inline bordered divs with Cards. Change:

```tsx
<div className="flex items-center justify-between rounded-md border px-4 py-3">
  <span className="text-sm">Theme</span>
  <button
    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    onClick={() => setPrefs.mutate({ theme: prefs.theme === "dark" ? "light" : "dark" })}
  >
    {prefs.theme === "dark" ? "Dark" : "Light"}
  </button>
</div>
```

To:

```tsx
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
```

Do the same for the font size row. Change:

```tsx
<div className="flex items-center justify-between rounded-md border px-4 py-3">
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
</div>
```

To:

```tsx
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
```

And the Storage section. Change:

```tsx
<div className="rounded-md border px-4 py-3">
  <p className="text-sm font-medium">App data directory</p>
  <p className="mt-1 break-all text-xs text-muted-foreground">{prefs.appMainDirectory}</p>
</div>
```

To:

```tsx
<Card>
  <CardContent className="py-3">
    <p className="text-sm font-medium">App data directory</p>
    <p className="mt-1 break-all text-xs text-muted-foreground">{prefs.appMainDirectory}</p>
  </CardContent>
</Card>
```

- [ ] **Step 2: Verify the Preferences page**

Run: `cd /Users/mertdogar/Workspace/personal/electrand && npm run start`

Verify:

- Theme toggle, font size controls, and storage info are wrapped in elevated Cards
- Interactive elements still work (theme toggles, font size +/-)
- Consistent visual style with the rest of the app

- [ ] **Step 3: Commit**

```bash
git add src/renderer/routes/preferences.tsx
git commit -m "style: use Card components in Preferences page"
```

---

### Task 5: Install shadcn Command component

**Files:**

- Create: `src/renderer/components/ui/command.tsx` (generated by shadcn CLI)

- [ ] **Step 1: Install the Command component via shadcn CLI**

Run:

```bash
cd /Users/mertdogar/Workspace/personal/electrand && npx shadcn@latest add command --yes
```

This will create `src/renderer/components/ui/command.tsx` which wraps the `cmdk` library with styled components: `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator`.

- [ ] **Step 2: Verify the component was created**

Run:

```bash
ls -la src/renderer/components/ui/command.tsx
```

Expected: file exists.

- [ ] **Step 3: Verify the app builds**

Run: `cd /Users/mertdogar/Workspace/personal/electrand && npm run start`

Expected: app starts without errors (the component is just installed, not used yet).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/ui/command.tsx package.json package-lock.json
git commit -m "feat: add shadcn Command component"
```

---

### Task 6: Create CommandPalette component

**Files:**

- Create: `src/renderer/components/command-palette.tsx`

- [ ] **Step 1: Create the CommandPalette component**

Create `src/renderer/components/command-palette.tsx`:

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
import { useProjects } from "@/hooks/use-projects"
import { usePreferences, useSetPreferences } from "@/hooks/use-preferences"
import { useSetAppState } from "@/hooks/use-app-state"

export function CommandPalette(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data: projects } = useProjects()
  const { data: prefs } = usePreferences()
  const setPrefs = useSetPreferences()
  const setAppState = useSetAppState()

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

- [ ] **Step 2: Verify the app builds**

Run: `cd /Users/mertdogar/Workspace/personal/electrand && npm run start`

Expected: app starts without errors (component exists but is not rendered yet).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/command-palette.tsx
git commit -m "feat: create CommandPalette component"
```

---

### Task 7: Wire CommandPalette into root layout

**Files:**

- Modify: `src/renderer/routes/__root.tsx`

- [ ] **Step 1: Import and render CommandPalette**

In `src/renderer/routes/__root.tsx`, add the import:

```tsx
import { CommandPalette } from "@/components/command-palette"
```

Then render `<CommandPalette />` inside the `SidebarProvider`, after `<SidebarInset>`. The full return becomes:

```tsx
return (
  <SidebarProvider>
    {isInProject ? <ProjectSidebar /> : <AppSidebar />}
    <SidebarInset>
      <Topbar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </SidebarInset>
    <CommandPalette />
  </SidebarProvider>
)
```

- [ ] **Step 2: Verify the command palette works end-to-end**

Run: `cd /Users/mertdogar/Workspace/personal/electrand && npm run start`

Verify:

- Press `Cmd+K` — the command palette dialog opens with a search input
- Type "home" — filters to show the Home navigation item
- Click "Home" — navigates to the home page and closes the palette
- Press `Cmd+K` again — palette reopens
- Click "Toggle Theme" — theme switches between light/dark
- Project names appear in the Projects section
- Press `Escape` — palette closes
- Press `Cmd+K` then `Cmd+K` again — palette toggles open/closed

- [ ] **Step 3: Commit**

```bash
git add src/renderer/routes/__root.tsx
git commit -m "feat: wire CommandPalette into root layout with Cmd+K shortcut"
```
