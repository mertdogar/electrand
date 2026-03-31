import React from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { LayoutDashboard, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSetAppState } from "@/hooks/use-app-state"
import { useProjects } from "@/hooks/use-projects"

export function ProjectSidebar(): React.ReactElement {
  const { projectId } = useParams({ strict: false }) as { projectId?: string }
  const { data: projects } = useProjects()
  const setAppState = useSetAppState()
  const navigate = useNavigate()

  const project = projects?.find((p) => p.id === projectId)

  const handleClose = (): void => {
    setAppState.mutate(
      { projectId: null },
      { onSuccess: () => void navigate({ to: "/" }) }
    )
  }

  return (
    <nav className="flex h-full flex-col gap-1 p-2">
      {project && (
        <p className="truncate px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {project.name}
        </p>
      )}
      <Link
        to="/projects/$projectId"
        params={{ projectId: projectId ?? "" }}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent [&.active]:bg-accent [&.active]:font-medium"
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        Overview
      </Link>
      <Link
        to="/projects/$projectId/settings"
        params={{ projectId: projectId ?? "" }}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent [&.active]:bg-accent [&.active]:font-medium"
      >
        <Settings className="h-4 w-4 shrink-0" />
        Settings
      </Link>
      <div className="mt-auto">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
          Close Project
        </Button>
      </div>
    </nav>
  )
}
