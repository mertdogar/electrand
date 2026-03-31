import React from "react"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { useProjects } from "@/hooks/use-projects"

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

  if (!project) return <p className="text-sm text-muted-foreground">Loading…</p>

  const rows: [string, string][] = [
    ["Path", project.path],
    ["Created", formatDate(project.createdAt)],
    ["Last updated", formatDate(project.updatedAt)],
    ["Last opened", project.lastOpenedAt ? formatDate(project.lastOpenedAt) : "—"],
  ]

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-xl font-semibold">{project.name}</h1>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b last:border-0">
              <td className="py-2 text-muted-foreground">{label}</td>
              <td className="py-2 text-right font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Project workspace — extend this area with your app-specific content.
      </div>
    </div>
  )
}
