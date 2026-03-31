# create-electrand — CLI Scaffolding Tool Design

**Date:** 2026-04-01
**Status:** Approved

## Overview

`create-electrand` is a standalone npm package that scaffolds new Electron desktop applications from the Electrand template. Users run `npx create-electrand my-app` to create a new project.

## Architecture

### Package

- **Name:** `create-electrand`
- **Location:** Standalone directory `create-electrand/` at the root of the Electrand repo
- **Published to:** npm
- **Entry:** `dist/index.mjs` (bundled single file with `#!/usr/bin/env node` shebang)

### Tech Stack

| Concern | Library | Purpose |
|---------|---------|---------|
| CLI parsing | citty | Typed argument parsing, auto `--help`/`--version` |
| Prompts | @clack/prompts | Interactive UX — confirm, spinner, intro/outro |
| Template download | giget | Download from GitHub tarball (no .git history) |
| Bundler | tsdown | Bundle TypeScript to single ESM file |

### Directory Structure

```
create-electrand/
├── src/
│   └── index.ts          # CLI entry point — all logic
├── package.json
├── tsconfig.json
└── tsdown.config.ts
```

## CLI Flow

### Command Syntax

```
npx create-electrand <project-name>
npx create-electrand --help
npx create-electrand --version
```

### Step-by-Step Flow

1. **Parse arguments** (citty)
   - Positional arg: `project-name` (required; prompt if missing)
   - Flags: `--help`, `--version`

2. **Validate project name**
   - Must be a valid directory name
   - Target directory must not already exist (or prompt to overwrite)

3. **Show intro** (@clack/prompts)
   ```
   ┌  create-electrand
   │
   ◇  Creating "my-app"...
   ```

4. **Download template** (giget)
   - Source: `github:mertdogar/electrand`
   - Downloads latest from default branch
   - Extracts to `./my-app/`
   - Show spinner during download

5. **Post-processing**
   - Remove files not relevant to new projects:
     - `.git/`
     - `.claude/`
     - `docs/superpowers/`
     - `create-electrand/` (the CLI package itself)
   - Update `package.json`:
     - Set `name` to the user's project name
     - Reset `version` to `0.0.1`

6. **Prompt: Install dependencies?**
   - Auto-detect package manager from `npm_config_user_agent` (npm/pnpm/yarn/bun)
   - If yes: run install with spinner
   - If no: skip

7. **Prompt: Initialize git repository?**
   - If yes: `git init` + initial commit
   - If no: skip

8. **Show outro with next steps**
   ```
   ◇  Done!
   │
   │  Next steps:
   │  cd my-app
   │  npm start
   │
   └
   ```

## Template Source

- **Repository:** https://github.com/mertdogar/electrand
- **Strategy:** giget downloads the latest tarball at runtime — no templates embedded in the npm package
- **Benefit:** Template updates are instant (no new CLI release needed), npm package stays tiny

## Post-Download Cleanup

### Files removed

| Path | Reason |
|------|--------|
| `.git/` | User gets a fresh repo (or none, their choice) |
| `.claude/` | Claude Code project config, not relevant to new users |
| `docs/superpowers/` | Design docs for the template itself |
| `create-electrand/` | The CLI package source |

### Files modified

| File | Change |
|------|--------|
| `package.json` | `name` → user's project name, `version` → `0.0.1` |

### Files kept

Everything else — the full Electron + React + Vite + TanStack + shadcn/ui template with all components, hooks, routes, IPC bridge, configs, etc.

## Package Publishing

```json
{
  "name": "create-electrand",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "create-electrand": "./dist/index.mjs"
  },
  "files": ["dist"]
}
```

### Dependencies

**Runtime:**
- `giget` — GitHub template download
- `citty` — CLI argument parsing
- `@clack/prompts` — interactive prompts and spinners

**Dev:**
- `tsdown` — bundler
- `typescript` — type checking

## Package Manager Detection

Detect from `process.env.npm_config_user_agent`:
- `npm/...` → npm
- `pnpm/...` → pnpm
- `yarn/...` → yarn
- `bun/...` → bun
- Fallback: npm
