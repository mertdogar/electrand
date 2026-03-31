import React, { useEffect } from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Topbar } from "@/components/topbar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { ProjectSidebar } from "@/components/sidebar/project-sidebar"
import { useAppState } from "@/hooks/use-app-state"
import { useIpcInvalidation } from "@/hooks/use-ipc-invalidation"
import { usePreferences } from "@/hooks/use-preferences"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

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
      {isInProject ? <ProjectSidebar /> : <AppSidebar />}
      <SidebarInset>
        <Topbar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  staticData: {},
})
