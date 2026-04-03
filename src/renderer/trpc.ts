import { createTRPCReact } from "@trpc/react-query"
import { ipcLink } from "electron-trpc-experimental/renderer"
import type { AppRouter } from "@main/router"

export const trpc = createTRPCReact<AppRouter>()

export function createTRPCClient() {
  return trpc.createClient({
    links: [ipcLink()],
  })
}
