import React, { useEffect } from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Titlebar } from "@/components/titlebar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { ProjectSidebar } from "@/components/sidebar/project-sidebar"
import { useAppState } from "@/hooks/use-app-state"
import { useIpcInvalidation } from "@/hooks/use-ipc-invalidation"
import { usePreferences } from "@/hooks/use-preferences"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { CommandPalette } from "@/components/command-palette"

function RootLayout(): React.ReactElement {
  useIpcInvalidation()
  const { data: appState } = useAppState()
  const { data: prefs } = usePreferences()
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
