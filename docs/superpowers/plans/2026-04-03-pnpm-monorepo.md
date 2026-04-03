# pnpm Monorepo Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the npm-based Electron project into a pnpm workspace monorepo with `apps/desktop` (Electron app) and `packages/create-electrand` (CLI tool).

**Architecture:** Move app files into `apps/desktop/`, move CLI into `packages/create-electrand/`, create workspace root config. Update Forge config resource paths. All source code imports remain unchanged since path aliases are workspace-relative.

**Tech Stack:** pnpm 10, Electron Forge, Vite, TypeScript.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `pnpm-workspace.yaml` | Workspace definition |
| Create | `.npmrc` | pnpm config with targeted hoisting |
| Create | `package.json` (root) | Workspace root scripts |
| Move | `package.json` → `apps/desktop/package.json` | App dependencies |
| Move | `src/` → `apps/desktop/src/` | App source code |
| Move | `forge.config.ts` → `apps/desktop/forge.config.ts` | Electron Forge config |
| Move | `forge.env.d.ts` → `apps/desktop/forge.env.d.ts` | Forge type declarations |
| Move | `index.html` → `apps/desktop/index.html` | Renderer entry HTML |
| Move | `components.json` → `apps/desktop/components.json` | shadcn config |
| Move | `vite.main.config.ts` → `apps/desktop/vite.main.config.ts` | Main process vite config |
| Move | `vite.preload.config.ts` → `apps/desktop/vite.preload.config.ts` | Preload vite config |
| Move | `vite.renderer.config.mts` → `apps/desktop/vite.renderer.config.mts` | Renderer vite config |
| Move | `vitest.config.ts` → `apps/desktop/vitest.config.ts` | Test config |
| Move | `tsconfig.json` → `apps/desktop/tsconfig.json` | TypeScript config |
| Move | `.oxlintrc.json` → `apps/desktop/.oxlintrc.json` | Lint config |
| Move | `.oxfmtrc.json` → `apps/desktop/.oxfmtrc.json` | Format config |
| Move | `create-electrand/` → `packages/create-electrand/` | CLI tool |
| Modify | `apps/desktop/forge.config.ts` | Update resource paths to `../../resources` |
| Delete | `package-lock.json` | Replaced by `pnpm-lock.yaml` |

**Stays at root (unchanged):**
- `README.md`
- `docs/`
- `resources/`
- `.gitignore` (updated with pnpm entries)
- `.vscode/`
- `.mcp.json`
- `.env`
- `.superpowers/`
- `.tanstack/`

---

### Task 1: Clean up and prepare

**Files:**
- Delete: `package-lock.json`
- Delete: `node_modules/` (root)
- Delete: `create-electrand/node_modules/`
- Delete: `create-electrand/package-lock.json`
- Delete: `out/` (build output)

- [ ] **Step 1: Remove npm artifacts and build output**

```bash
rm -rf node_modules out package-lock.json create-electrand/node_modules create-electrand/package-lock.json
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove npm artifacts before pnpm migration"
```

---

### Task 2: Create workspace root config files

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

Create `pnpm-workspace.yaml` at the project root:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create `.npmrc`**

Create `.npmrc` at the project root:

```ini
public-hoist-pattern[]=electron
public-hoist-pattern[]=better-sqlite3
public-hoist-pattern[]=@electron/*
public-hoist-pattern[]=bindings
public-hoist-pattern[]=file-uri-to-path
```

- [ ] **Step 3: Update `.gitignore`**

Add to the end of `.gitignore`:

```
# pnpm
.pnpm-store/
```

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml .npmrc .gitignore
git commit -m "chore: add pnpm workspace config and .npmrc"
```

---

### Task 3: Move app files into `apps/desktop/`

**Files:**
- Move: all app-specific files from root → `apps/desktop/`

- [ ] **Step 1: Create the apps/desktop directory**

```bash
mkdir -p apps/desktop
```

- [ ] **Step 2: Move app source and config files**

```bash
git mv src apps/desktop/
git mv package.json apps/desktop/
git mv forge.config.ts apps/desktop/
git mv forge.env.d.ts apps/desktop/
git mv index.html apps/desktop/
git mv components.json apps/desktop/
git mv vite.main.config.ts apps/desktop/
git mv vite.preload.config.ts apps/desktop/
git mv vite.renderer.config.mts apps/desktop/
git mv vitest.config.ts apps/desktop/
git mv tsconfig.json apps/desktop/
git mv .oxlintrc.json apps/desktop/
git mv .oxfmtrc.json apps/desktop/
```

- [ ] **Step 3: Move create-electrand into packages/**

```bash
mkdir -p packages
git mv create-electrand packages/create-electrand
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: move app into apps/desktop/ and CLI into packages/create-electrand/"
```

---

### Task 4: Create root `package.json`

**Files:**
- Create: `package.json` (root)

- [ ] **Step 1: Create root package.json**

Create `package.json` at the project root:

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

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add workspace root package.json"
```

---

### Task 5: Update `apps/desktop/forge.config.ts` resource paths

**Files:**
- Modify: `apps/desktop/forge.config.ts`

- [ ] **Step 1: Update icon paths to reference root resources/**

In `apps/desktop/forge.config.ts`, update all `path.resolve(__dirname, "resources", ...)` references to `path.resolve(__dirname, "../../resources", ...)`:

Line 14 — packagerConfig icon:
```ts
// OLD:
icon: path.resolve(__dirname, "resources", "icon"),
// NEW:
icon: path.resolve(__dirname, "../../resources", "icon"),
```

Line 29 — MakerSquirrel setupIcon:
```ts
// OLD:
setupIcon: path.resolve(__dirname, "resources", "icon.ico"),
// NEW:
setupIcon: path.resolve(__dirname, "../../resources", "icon.ico"),
```

Line 34 — MakerRpm icon:
```ts
// OLD:
icon: path.resolve(__dirname, "resources", "icon.png"),
// NEW:
icon: path.resolve(__dirname, "../../resources", "icon.png"),
```

Line 39 — MakerDeb icon:
```ts
// OLD:
icon: path.resolve(__dirname, "resources", "icon.png"),
// NEW:
icon: path.resolve(__dirname, "../../resources", "icon.png"),
```

No changes needed for:
- `VitePlugin` build entries — they use relative paths like `"src/main/main.ts"` which resolve from the workspace dir
- `packageAfterCopy` hook — resolves `node_modules` from `__dirname`, pnpm creates symlinks in the workspace's `node_modules/`

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/forge.config.ts
git commit -m "fix: update forge config resource paths for monorepo layout"
```

---

### Task 6: Install dependencies with pnpm and verify

- [ ] **Step 1: Install pnpm if not already available**

```bash
corepack enable
corepack prepare pnpm@10.12.1 --activate
```

Or if corepack is not available:

```bash
npm install -g pnpm@10.12.1
```

- [ ] **Step 2: Install all workspace dependencies**

```bash
pnpm install
```

Expected: Creates `pnpm-lock.yaml` at root, installs dependencies for both `apps/desktop` and `packages/create-electrand`.

- [ ] **Step 3: Verify the Electron app builds and launches**

```bash
cd apps/desktop && pnpm start
```

Or from root:

```bash
pnpm dev
```

Expected: Vite dev servers start, Electron app launches, no console errors.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/desktop && npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 5: Commit the lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "chore: add pnpm-lock.yaml"
```

---

### Task 7: Fix any issues and final cleanup

- [ ] **Step 1: Verify native module rebuild works**

```bash
cd apps/desktop && pnpm run postinstall
```

Expected: `electron-rebuild` successfully rebuilds `better-sqlite3`.

- [ ] **Step 2: Test the packaged build**

```bash
cd apps/desktop && pnpm run package
```

Expected: Builds a distributable app in `apps/desktop/out/`. The `packageAfterCopy` hook should find `better-sqlite3`, `bindings`, and `file-uri-to-path` in the workspace's `node_modules/`.

- [ ] **Step 3: Verify create-electrand still works**

```bash
cd packages/create-electrand && pnpm run build
```

Expected: Builds successfully.

- [ ] **Step 4: Commit any fixes**

If any adjustments were needed:

```bash
git add -A
git commit -m "fix: address issues found during pnpm migration verification"
```
