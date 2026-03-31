import path from "path"
import { fileURLToPath } from "url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/renderer/routes",
      generatedRouteTree: "./src/renderer/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer"),
      "@main": path.resolve(__dirname, "./src/main"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
})
