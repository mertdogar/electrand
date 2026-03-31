import React, { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FolderOpen, Plus } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProjects, useCreateProject } from "@/hooks/use-projects"
import { useSetAppState } from "@/hooks/use-app-state"
import { PageContent, PageTitle } from "@/components/ui/page"
import type { Project } from "@shared/schemas"

export const Route = createFileRoute("/")({
  component: HomeScreen,
  staticData: { title: "Home" },
})

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso)
  )
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never opened"
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days} days ago`
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: Project
  onOpen: (id: string) => void
}): React.ReactElement {
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onOpen(project.id)}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 shrink-0" />
          {project.name}
        </CardTitle>
        <CardDescription className="truncate">{project.path}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Last opened: {formatRelative(project.lastOpenedAt)}
        </p>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Created {formatDate(project.createdAt)}
        </p>
      </CardFooter>
    </Card>
  )
}

function NewProjectForm({
  onCancel,
}: {
  onCancel: () => void
}): React.ReactElement {
  const [name, setName] = useState("")
  const [projectPath, setProjectPath] = useState("")
  const createProject = useCreateProject()

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!name.trim()) return
    createProject.mutate(
      { name: name.trim(), path: projectPath.trim() || `/projects/${name.trim().toLowerCase()}` },
      { onSuccess: onCancel }
    )
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>New Project</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Path (optional)"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
          />
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={!name.trim() || createProject.isPending}>
            Create
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function HomeScreen(): React.ReactElement {
  const { data: projects, isLoading } = useProjects()
  const setAppState = useSetAppState()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)

  const handleOpenProject = (id: string): void => {
    setAppState.mutate(
      { projectId: id },
      {
        onSuccess: () => void navigate({ to: "/projects/$projectId", params: { projectId: id } }),
        onError: (err) => console.error("Failed to open project:", err),
      }
    )
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-6">Loading…</p>
  }

  return (
    <PageContent>
      <div className="flex items-center justify-between">
        <PageTitle>Projects</PageTitle>
        <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Project
        </Button>
      </div>

      {showForm && <NewProjectForm onCancel={() => setShowForm(false)} />}

      {!projects?.length && !showForm ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <FolderOpen className="h-10 w-10 opacity-40" />
          <p className="text-sm">No projects yet.</p>
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} onOpen={handleOpenProject} />
          ))}
        </div>
      )}
    </PageContent>
  )
}
