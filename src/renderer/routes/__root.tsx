import React, { useEffect } from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Titlebar } from "@/components/titlebar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { ProjectSidebar } from "@/components/sidebar/project-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { CommandPalette } from "@/components/command-palette"
import { trpc } from "@/trpc"

function useInvalidationSubscriptions() {
  const utils = trpc.useUtils()

  trpc.preferences.onChange.useSubscription(undefined, {
    onData: () => void utils.preferences.get.invalidate(),
  })
  trpc.projects.onChange.useSubscription(undefined, {
    onData: () => void utils.projects.list.invalidate(),
  })
  trpc.appState.onChange.useSubscription(undefined, {
    onData: () => void utils.appState.get.invalidate(),
  })
}

function RootLayout(): React.ReactElement {
  useInvalidationSubscriptions()
  const { data: appState } = trpc.appState.get.useQuery()
  const { data: prefs } = trpc.preferences.get.useQuery()
  const isInProject = appState?.projectId != null

  useEffect(() => {
    if (!prefs) return
    document.documentElement.classList.toggle("dark", prefs.theme === "dark")
  }, [prefs?.theme])

  return (
    <SidebarProvider>
      <Titlebar />
      {isInProject ? <ProjectSidebar /> : <AppSidebar />}
      <SidebarInset>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  staticData: {},
})
