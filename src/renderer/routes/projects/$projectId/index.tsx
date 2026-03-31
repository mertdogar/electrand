import React from "react"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { useProjects } from "@/hooks/use-projects"
import { PageContent, PageMeta, PageTitle } from "@/components/ui/page"

export const Route = createFileRoute("/projects/$projectId/")({
  component: ProjectOverview,
  staticData: { title: "Overview" },
})

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

function ProjectOverview(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId/" })
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  if (!project) return <p className="text-sm text-muted-foreground p-6">Loading…</p>

  const rows: [string, string][] = [
    ["Path", project.path],
    ["Created", formatDate(project.createdAt)],
    ["Last updated", formatDate(project.updatedAt)],
    ["Last opened", project.lastOpenedAt ? formatDate(project.lastOpenedAt) : "—"],
  ]

  return (
    <PageContent>
      <PageTitle>{project.name}</PageTitle>
      <PageMeta rows={rows} />
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Project workspace — extend this area with your app-specific content.
      </div>
    </PageContent>
  )
}
