# create-electrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI tool (`create-electrand`) that scaffolds new Electron apps from the Electrand template via `npx create-electrand my-app`.

**Architecture:** Standalone npm package using giget to download the template from GitHub, citty for CLI arg parsing, and @clack/prompts for interactive UX. Bundled with tsdown into a single ESM file.

**Tech Stack:** giget, citty, @clack/prompts, tsdown, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-01-create-electrand-design.md`

---

## File Structure

```
create-electrand/
├── src/
│   └── index.ts          # CLI entry point — all logic in one file
├── package.json          # Package manifest with bin field
├── tsconfig.json         # TypeScript config
└── tsdown.config.ts      # Build config
```

---

### Task 1: Initialize package and config files

**Files:**
- Create: `create-electrand/package.json`
- Create: `create-electrand/tsconfig.json`
- Create: `create-electrand/tsdown.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "create-electrand",
  "version": "1.0.0",
  "description": "Create a new Electrand app",
  "type": "module",
  "bin": {
    "create-electrand": "./dist/index.mjs"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch"
  },
  "dependencies": {
    "citty": "^0.2.1",
    "@clack/prompts": "^0.10.0",
    "giget": "^2.0.0"
  },
  "devDependencies": {
    "tsdown": "^0.12.0",
    "typescript": "^5.7.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create tsdown.config.ts**

```typescript
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  shims: true,
  outputOptions: {
    banner: "#!/usr/bin/env node",
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `cd create-electrand && npm install`
Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 5: Commit**

```bash
git add create-electrand/package.json create-electrand/tsconfig.json create-electrand/tsdown.config.ts create-electrand/package-lock.json
git commit -m "feat(create-electrand): initialize package with config files"
```

---

### Task 2: Implement CLI entry point — argument parsing and validation

**Files:**
- Create: `create-electrand/src/index.ts`

- [ ] **Step 1: Write the CLI skeleton with citty**

```typescript
import { defineCommand, runMain } from "citty";
import {
  intro,
  outro,
  text,
  confirm,
  spinner,
  isCancel,
  cancel,
} from "@clack/prompts";
import { downloadTemplate } from "giget";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { execSync } from "node:child_process";

const main = defineCommand({
  meta: {
    name: "create-electrand",
    version: "1.0.0",
    description: "Create a new Electrand app",
  },
  args: {
    name: {
      type: "positional",
      description: "Project name",
      required: false,
    },
  },
  async run({ args }) {
    intro("create-electrand");

    // 1. Get project name
    let projectName = args.name;
    if (!projectName) {
      const value = await text({
        message: "What is your project name?",
        placeholder: "my-app",
        validate(value) {
          if (!value || value.trim().length === 0) return "Project name is required.";
          if (/[<>:"/\\|?*]/.test(value)) return "Invalid characters in project name.";
        },
      });
      if (isCancel(value)) {
        cancel("Operation cancelled.");
        process.exit(0);
      }
      projectName = value;
    }

    // 2. Check if directory exists
    const targetDir = resolve(process.cwd(), projectName);
    if (existsSync(targetDir)) {
      const overwrite = await confirm({
        message: `Directory "${projectName}" already exists. Overwrite?`,
      });
      if (isCancel(overwrite) || !overwrite) {
        cancel("Operation cancelled.");
        process.exit(0);
      }
    }

    // 3. Download template
    const s = spinner();
    s.start("Downloading Electrand template...");

    await downloadTemplate("github:mertdogar/electrand", {
      dir: targetDir,
      forceClean: true,
    });

    s.stop("Template downloaded.");

    // 4. Clean up template-specific files
    const toRemove = [".git", ".claude", "docs/superpowers", "create-electrand"];
    for (const entry of toRemove) {
      const entryPath = resolve(targetDir, entry);
      if (existsSync(entryPath)) {
        rmSync(entryPath, { recursive: true, force: true });
      }
    }

    // 5. Update package.json
    const pkgPath = resolve(targetDir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    pkg.name = projectName;
    pkg.version = "0.0.1";
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

    // 6. Detect package manager
    const packageManager = detectPackageManager();

    // 7. Prompt: install dependencies?
    const shouldInstall = await confirm({
      message: `Install dependencies with ${packageManager}?`,
    });

    if (!isCancel(shouldInstall) && shouldInstall) {
      s.start(`Installing dependencies with ${packageManager}...`);
      execSync(`${packageManager} install`, { cwd: targetDir, stdio: "ignore" });
      s.stop("Dependencies installed.");
    }

    // 8. Prompt: init git?
    const shouldGitInit = await confirm({
      message: "Initialize a git repository?",
    });

    if (!isCancel(shouldGitInit) && shouldGitInit) {
      execSync("git init", { cwd: targetDir, stdio: "ignore" });
      execSync("git add -A", { cwd: targetDir, stdio: "ignore" });
      execSync('git commit -m "Initial commit from create-electrand"', {
        cwd: targetDir,
        stdio: "ignore",
      });
      s.stop("Git repository initialized.");
    }

    // 9. Outro
    outro("You're all set!");

    const relativePath = basename(targetDir);
    console.log("");
    console.log("  Next steps:");
    console.log(`  cd ${relativePath}`);
    if (!shouldInstall || isCancel(shouldInstall)) {
      console.log(`  ${packageManager} install`);
    }
    console.log(`  ${packageManager} start`);
    console.log("");
  },
});

function detectPackageManager(): string {
  const agent = process.env.npm_config_user_agent;
  if (!agent) return "npm";
  if (agent.startsWith("pnpm")) return "pnpm";
  if (agent.startsWith("yarn")) return "yarn";
  if (agent.startsWith("bun")) return "bun";
  return "npm";
}

runMain(main);
```

- [ ] **Step 2: Build the CLI**

Run: `cd create-electrand && npx tsdown`
Expected: `dist/index.mjs` created with shebang at the top.

- [ ] **Step 3: Test locally**

Run: `cd /tmp && node /path/to/create-electrand/dist/index.mjs test-app`
Expected: Prompts appear, template is downloaded, `test-app/` directory is created with the Electrand template. `package.json` inside has `"name": "test-app"` and `"version": "0.0.1"`. No `.git/`, `.claude/`, `docs/superpowers/`, or `create-electrand/` directories.

- [ ] **Step 4: Test --help flag**

Run: `node create-electrand/dist/index.mjs --help`
Expected: Shows usage info with `create-electrand [name]` and description.

- [ ] **Step 5: Test --version flag**

Run: `node create-electrand/dist/index.mjs --version`
Expected: Prints `1.0.0`.

- [ ] **Step 6: Clean up test artifacts**

Run: `rm -rf /tmp/test-app`

- [ ] **Step 7: Commit**

```bash
git add create-electrand/src/index.ts
git commit -m "feat(create-electrand): implement CLI with template download and prompts"
```

---

### Task 3: Final build, verify, and prepare for npm publish

**Files:**
- Modify: `create-electrand/package.json` (if version adjustments needed)

- [ ] **Step 1: Production build**

Run: `cd create-electrand && npx tsdown`
Expected: `dist/index.mjs` exists, starts with `#!/usr/bin/env node`.

- [ ] **Step 2: Verify dist/index.mjs has shebang**

Run: `head -1 create-electrand/dist/index.mjs`
Expected: `#!/usr/bin/env node`

- [ ] **Step 3: Dry-run npm pack to check what gets published**

Run: `cd create-electrand && npm pack --dry-run`
Expected: Only `dist/index.mjs`, `package.json`, and any other `dist/` files are listed. No `src/`, `node_modules/`, etc.

- [ ] **Step 4: Test full flow from npx simulation**

Run:
```bash
cd /tmp
node /path/to/create-electrand/dist/index.mjs npx-test-app
# Answer "yes" to install, "yes" to git init
```

Verify:
- `/tmp/npx-test-app/` exists
- `package.json` has `"name": "npx-test-app"`, `"version": "0.0.1"`
- `node_modules/` exists (deps installed)
- `.git/` exists with one commit
- No `.claude/`, `docs/superpowers/`, `create-electrand/` directories
- `src/main/main.ts`, `src/renderer/App.tsx`, `forge.config.ts` all exist (template intact)

- [ ] **Step 5: Clean up test artifacts**

Run: `rm -rf /tmp/npx-test-app`

- [ ] **Step 6: Commit build output if needed, tag for release**

```bash
git add create-electrand/
git commit -m "feat(create-electrand): ready for npm publish"
```

**Note:** To publish to npm, the user runs:
```bash
cd create-electrand
npm publish
```

After publishing, users can run: `npx create-electrand my-app`
