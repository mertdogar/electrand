# pnpm Monorepo Conversion Design Spec

## Overview

Convert the npm-based single-package Electron project into a pnpm workspace monorepo. This establishes the monorepo skeleton that downstream apps built from this template will grow into.

## Directory Structure

```
electrand/
├── apps/
│   └── desktop/                    # Electron app (moved from root)
│       ├── src/
│       │   ├── main/
│       │   ├── renderer/
│       │   └── shared/
│       ├── forge.config.ts
│       ├── forge.env.d.ts
│       ├── index.html
│       ├── components.json
│       ├── vite.main.config.ts
│       ├── vite.preload.config.ts
│       ├── vite.renderer.config.mts
│       ├── vitest.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── create-electrand/           # CLI tool (moved from ./create-electrand/)
│       ├── src/
│       ├── dist/
│       ├── package.json
│       └── tsconfig.json
├── docs/                           # stays at root
├── resources/                      # stays at root (app icon shared across workspace)
├── README.md
├── .gitignore
├── .npmrc
├── pnpm-workspace.yaml
└── package.json                    # workspace root
```

## Root Configuration Files

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `.npmrc`

```ini
public-hoist-pattern[]=electron
public-hoist-pattern[]=better-sqlite3
public-hoist-pattern[]=@electron/*
public-hoist-pattern[]=bindings
public-hoist-pattern[]=file-uri-to-path
```

`bindings` and `file-uri-to-path` are transitive dependencies of `better-sqlite3` that the Forge `packageAfterCopy` hook needs to resolve. They must be hoisted alongside `better-sqlite3`.

### Root `package.json`

```json
{
  "name": "electrand-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter electrand start",
    "build": "pnpm --filter electrand package",
    "lint": "pnpm -r lint",
    "format": "pnpm -r format"
  },
  "packageManager": "pnpm@10.12.1"
}
```

No dependencies at root. The `packageManager` field enables Corepack and pins the pnpm version.

## `apps/desktop/package.json` Changes

- Keep name as `electrand` (it's the publishable/distributable app name, not an npm package)
- Keep all existing dependencies and devDependencies
- Update `postinstall` script: `electron-rebuild` should work from workspace root via pnpm's hoisting

## Config File Path Updates

All config files use `__dirname` for path resolution. After moving into `apps/desktop/`, only paths that reference root-level files (like `resources/`) need updating.

### `forge.config.ts`

Resource paths change from `__dirname, "resources"` to `__dirname, "../../resources"`:

```ts
packagerConfig: {
  icon: path.resolve(__dirname, "../../resources", "icon"),
  // ...
}
```

The `packageAfterCopy` hook resolves `node_modules` relative to `__dirname`. With pnpm's symlinked structure, the workspace's `node_modules/` contains symlinks to the hoisted packages. The `cp` function follows symlinks by default, so the existing hook logic works without changes — pnpm's `public-hoist-pattern` ensures the required packages are accessible.

### Vite Configs

The `@shared`, `@main`, `@`, `@lib` aliases all resolve relative to `__dirname` + `./src/...`. Since `src/` moves with the app, these paths are unchanged.

### `tsconfig.json`

Same as vite — path aliases are relative to `baseUrl: "."` which is the workspace directory. No changes needed.

### `vitest.config.ts`

Same — aliases resolve relative to `__dirname`. No changes needed.

### `components.json` (shadcn)

Paths like `src/renderer/index.css` and aliases like `@/components` are relative. No changes needed.

## `packages/create-electrand/`

Simply moves from `./create-electrand/` to `./packages/create-electrand/`. No changes to its `package.json` or source code — it has no dependencies on the desktop app.

## `.gitignore` Updates

Add pnpm-specific entries, remove npm-specific:

```
# pnpm
pnpm-lock.yaml is tracked (not ignored)

# Remove package-lock.json reference if any
```

No substantive changes needed — the existing `.gitignore` already covers `node_modules/`, `out/`, `.vite/`.

## What Does NOT Change

- **All source code** — no import changes since aliases are workspace-relative
- **`src/main/main.ts`** — `__dirname`-relative paths for preload/resources are resolved at build time by Forge
- **`docs/`**, **`README.md`** — stay at root
- **`resources/`** — stays at root, referenced from `apps/desktop/forge.config.ts` via `../../resources`

## Migration Order

1. Remove `package-lock.json` and `node_modules/`
2. Create root config files (`pnpm-workspace.yaml`, `.npmrc`, root `package.json`)
3. Create `apps/desktop/` and `packages/` directories
4. Move app files into `apps/desktop/`
5. Move `create-electrand/` into `packages/create-electrand/`
6. Update `forge.config.ts` resource paths
7. Run `pnpm install`
8. Verify `pnpm --filter @electrand/desktop start` launches the app
