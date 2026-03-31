import React from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Topbar } from "@/components/topbar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
// import { AppSidebar } from "@/components/app-sidebar"
import { ProjectSidebar } from "@/components/sidebar/project-sidebar"
import { useAppState } from "@/hooks/use-app-state"
import { useIpcInvalidation } from "@/hooks/use-ipc-invalidation"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"


function RootLayout(): React.ReactElement {
  useIpcInvalidation()
  const { data: appState } = useAppState()
  const isInProject = appState?.projectId != null

  return (
      <SidebarProvider className="h-screen w-screen">
    <ResizablePanelGroup orientation="horizontal" className="h-screen w-screen">
      <ResizablePanel defaultSize="20" maxSize="20" minSize="10">
        <div className="flex h-full flex-col relative">
        {isInProject ? <ProjectSidebar /> : <AppSidebar />}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        <div className="flex h-full flex-col">
          <Topbar />
          <main className="flex-1 overflow-auto p-4">
            <Outlet />
          </main>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
    </SidebarProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  staticData: {},
})
