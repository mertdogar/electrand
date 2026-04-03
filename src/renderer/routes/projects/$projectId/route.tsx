import React, { useEffect } from "react"
import { createFileRoute, Outlet, useParams } from "@tanstack/react-router"
import { trpc } from "@/trpc"

function ProjectLayout(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId" })
  const setAppState = trpc.appState.set.useMutation()
  const { data: projects } = trpc.projects.list.useQuery()
  const project = projects?.find((p) => p.id === projectId)

  useEffect(() => {
    setAppState.mutate(
      { projectId },
      { onError: (err) => console.error("Failed to set active project:", err) },
    )
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
