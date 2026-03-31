import React from "react"
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router"
import { FolderOpen, X } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useSetAppState } from "@/hooks/use-app-state"
import { useProjects } from "@/hooks/use-projects"

export function ProjectSidebar(): React.ReactElement | null {
  const params = useParams({ strict: false }) as { projectId?: string }
  const projectId = params.projectId
  const { data: projects } = useProjects()
  const setAppState = useSetAppState()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (!projectId) return null

  const project = projects?.find((p) => p.id === projectId)

  const handleClose = (): void => {
    setAppState.mutate(
      { projectId: null },
      {
        onSuccess: () => void navigate({ to: "/" }),
        onError: (err) => console.error("Failed to close project:", err),
      },
    )
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <FolderOpen className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none overflow-hidden">
                  <span className="font-semibold truncate">{project?.name ?? "Project"}</span>
                  <span className="text-xs text-muted-foreground">Project</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `/projects/${projectId}`}>
                <Link to="/projects/$projectId" params={{ projectId }}>
                  Overview
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === `/projects/${projectId}/settings`}>
                <Link to="/projects/$projectId/settings" params={{ projectId }}>
                  Settings
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleClose}>
              <X className="size-4" />
              Close Project
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
