# UI Polish & Command Palette

## Overview

Two improvements to Electrand's UI:

1. **Form & card restyling** — replace amateur-looking bordered forms/cards with a cohesive elevated/shadow style
2. **Command palette** — full-power `Cmd+K` palette using `cmdk` (already installed) for navigation, project actions, and settings

## 1. Form & Card Restyling

### Problem

Current forms use plain HTML `<input>` elements with harsh `border` classes (`rounded-md border bg-background px-3 py-2 text-sm`). They look amateur and don't match the polished shadcn sidebar/button aesthetic already in the app.

### Solution: Elevated/Floating Style

**Input treatment**: Replace raw `<input>` tags with the shadcn `Input` component. Override its default border-heavy style with a softer elevated look:

- Remove the hard `border-input` border
- Add `shadow-sm` for subtle elevation
- Use a very faint border (`border-border/40`) so it doesn't disappear entirely
- White/card background that lifts inputs off the page surface

Apply this by updating the `Input` component's base classes in `src/renderer/components/ui/input.tsx` so all inputs get the treatment automatically.

New Input base classes:

```
border-border/40 bg-card shadow-sm
focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50
```

### Files changed

| File                                                   | Change                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/ui/input.tsx`                 | Update base classes: softer border, shadow-sm, bg-card                                                         |
| `src/renderer/routes/index.tsx`                        | Replace raw `<input>` with shadcn `Input` component. Add `hover:shadow-md transition-shadow` to `ProjectCard`. |
| `src/renderer/routes/projects/$projectId/settings.tsx` | Replace raw `<input>` with shadcn `Input`. Wrap danger zone in shadcn `Card` with destructive accent.          |
| `src/renderer/routes/preferences.tsx`                  | Replace inline `rounded-md border` wrappers with shadcn `Card` for each settings row.                          |

### Card treatment

The shadcn `Card` component already uses `shadow-sm` which aligns with the elevated style. The existing Card classes (`rounded-xl border bg-card shadow-sm`) are fine — the border is already subtle. For project cards, add `hover:shadow-md transition-shadow` for interactive feedback.

## 2. Command Palette

### Architecture

A single `CommandPalette` component rendered in the root layout (`__root.tsx`), using:

- `cmdk` (already installed as dependency)
- shadcn `Command` component (needs to be added via `npx shadcn@latest add command`)
- shadcn `Dialog` for the overlay container

### Trigger

- `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux) keyboard shortcut
- Global `useEffect` keydown listener in the root layout

### Palette sections

**Navigation** — jump to pages using TanStack Router:
| Label | Route | Icon |
|-------|-------|------|
| Home | `/` | `Home` |
| Preferences | `/preferences` | `Settings` |
| About | `/about` | `Info` |

**Projects** — dynamic list from `useProjects()`:
| Label | Action | Icon |
|-------|--------|------|
| Open {project.name} | Navigate to `/projects/$projectId` | `FolderOpen` |
| New Project | Navigate to `/` and trigger form | `Plus` |

**Settings** — quick toggles:
| Label | Action | Icon |
|-------|--------|------|
| Toggle Theme | Calls `useSetPreferences({ theme: toggle })` | `Sun`/`Moon` |
| Increase Font Size | Calls `useSetPreferences({ fontSize: +1 })` | `Plus` |
| Decrease Font Size | Calls `useSetPreferences({ fontSize: -1 })` | `Minus` |

### New files

| File                                          | Purpose                                      |
| --------------------------------------------- | -------------------------------------------- |
| `src/renderer/components/command-palette.tsx` | `CommandPalette` component with all sections |

### Modified files

| File                             | Change                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `src/renderer/routes/__root.tsx` | Import and render `<CommandPalette />` inside `SidebarProvider`, add `Cmd+K` listener |

### Component structure

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="p-0 overflow-hidden">
    <Command>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem>Home</CommandItem>
          <CommandItem>Preferences</CommandItem>
          <CommandItem>About</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Projects">
          {projects.map((p) => (
            <CommandItem>Open {p.name}</CommandItem>
          ))}
          <CommandItem>New Project</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Settings">
          <CommandItem>Toggle Theme</CommandItem>
          <CommandItem>Increase Font Size</CommandItem>
          <CommandItem>Decrease Font Size</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </DialogContent>
</Dialog>
```

### Keyboard shortcut display

Each command item shows its shortcut on the right side using `<CommandShortcut>`:

- Home: `Cmd+H` (display only — not wired as actual shortcut)
- Toggle Theme: no shortcut display

## Dependencies

- `cmdk` — already installed
- shadcn `Command` component — needs `npx shadcn@latest add command` (pulls in `cmdk` wrapper + `CommandDialog`, `CommandInput`, etc.)
- No new npm packages needed

## Out of scope

- Form validation library (react-hook-form / Zod) — current manual state management is fine for 2-field forms
- Global keyboard shortcuts beyond `Cmd+K` — can be added later
- Fuzzy search across file contents — palette only searches command labels
