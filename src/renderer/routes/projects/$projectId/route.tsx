import React, { useEffect } from "react"
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router"
import { useSetAppState } from "@/hooks/use-app-state"
import { useProjects } from "@/hooks/use-projects"

function ProjectLayout(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId" })
  const setAppState = useSetAppState()
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  useEffect(() => {
    setAppState.mutate({ projectId })
  }, [projectId])

  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>
  }

  return <Outlet />
}

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectLayout,
  staticData: {},
})
