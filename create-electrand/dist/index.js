#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { cancel, confirm, intro, isCancel, outro, spinner, text } from "@clack/prompts";
import { downloadTemplate } from "giget";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { execSync } from "node:child_process";
//#region src/index.ts
const main = defineCommand({
	meta: {
		name: "create-electrand",
		version: "1.0.0",
		description: "Create a new Electrand app"
	},
	args: { name: {
		type: "positional",
		description: "Project name",
		required: false
	} },
	async run({ args }) {
		intro("create-electrand");
		let projectName = args.name;
		if (!projectName) {
			const value = await text({
				message: "What is your project name?",
				placeholder: "my-app",
				validate(value) {
					if (!value || value.trim().length === 0) return "Project name is required.";
				}
			});
			if (isCancel(value)) {
				cancel("Operation cancelled.");
				process.exit(0);
			}
			projectName = value;
		}
		if (/[<>:"/\\|?*]/.test(projectName)) {
			cancel("Invalid characters in project name.");
			process.exit(1);
		}
		const targetDir = resolve(process.cwd(), projectName);
		if (existsSync(targetDir)) {
			const overwrite = await confirm({ message: `Directory "${projectName}" already exists. Overwrite?` });
			if (isCancel(overwrite) || !overwrite) {
				cancel("Operation cancelled.");
				process.exit(0);
			}
		}
		const s = spinner();
		s.start("Downloading Electrand template...");
		try {
			await downloadTemplate("github:mertdogar/electrand", {
				dir: targetDir,
				forceClean: true
			});
		} catch (err) {
			s.stop("Failed to download template.");
			process.exit(1);
		}
		s.stop("Template downloaded.");
		for (const entry of [
			".git",
			".claude",
			"docs/superpowers",
			"create-electrand"
		]) {
			const entryPath = resolve(targetDir, entry);
			if (existsSync(entryPath)) rmSync(entryPath, {
				recursive: true,
				force: true
			});
		}
		const pkgPath = resolve(targetDir, "package.json");
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		pkg.name = projectName;
		pkg.version = "0.0.1";
		writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
		const packageManager = detectPackageManager();
		const shouldInstall = await confirm({ message: `Install dependencies with ${packageManager}?` });
		if (!isCancel(shouldInstall) && shouldInstall) {
			s.start(`Installing dependencies with ${packageManager}...`);
			try {
				execSync(`${packageManager} install`, {
					cwd: targetDir,
					stdio: "ignore"
				});
			} catch (err) {
				s.stop("Failed to install dependencies.");
				process.exit(1);
			}
			s.stop("Dependencies installed.");
		}
		const shouldGitInit = await confirm({ message: "Initialize a git repository?" });
		if (!isCancel(shouldGitInit) && shouldGitInit) {
			s.start("Initializing git repository...");
			try {
				execSync("git init", {
					cwd: targetDir,
					stdio: "ignore"
				});
				execSync("git add -A", {
					cwd: targetDir,
					stdio: "ignore"
				});
				execSync("git commit -m \"Initial commit from create-electrand\"", {
					cwd: targetDir,
					stdio: "ignore"
				});
			} catch (err) {
				s.stop("Failed to initialize git repository.");
				process.exit(1);
			}
			s.stop("Git repository initialized.");
		}
		outro("You're all set!");
		const relativePath = basename(targetDir);
		console.log("");
		console.log("  Next steps:");
		console.log(`  cd ${relativePath}`);
		if (!shouldInstall || isCancel(shouldInstall)) console.log(`  ${packageManager} install`);
		console.log(`  ${packageManager} start`);
		console.log("");
	}
});
function detectPackageManager() {
	const agent = process.env.npm_config_user_agent;
	if (!agent) return "npm";
	if (agent.startsWith("pnpm")) return "pnpm";
	if (agent.startsWith("yarn")) return "yarn";
	if (agent.startsWith("bun")) return "bun";
	return "npm";
}
runMain(main);
//#endregion
export {};
