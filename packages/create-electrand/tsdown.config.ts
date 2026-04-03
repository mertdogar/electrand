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
