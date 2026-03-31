import React from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Topbar } from "@/components/topbar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { ProjectSidebar } from "@/components/sidebar/project-sidebar"
import { useAppState } from "@/hooks/use-app-state"
import { useIpcInvalidation } from "@/hooks/use-ipc-invalidation"

function RootLayout(): React.ReactElement {
  useIpcInvalidation()
  const { data: appState } = useAppState()
  const isInProject = appState?.projectId != null

  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen w-screen">
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
        {isInProject ? <ProjectSidebar /> : <AppSidebar />}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={80}>
        <div className="flex h-full flex-col">
          <Topbar />
          <main className="flex-1 overflow-auto p-4">
            <Outlet />
          </main>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
