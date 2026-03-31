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
