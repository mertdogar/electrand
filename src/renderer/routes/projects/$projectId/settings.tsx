import React, { useState, useEffect } from "react"
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { useProjects, useUpdateProject, useDeleteProject } from "@/hooks/use-projects"
import { useSetAppState } from "@/hooks/use-app-state"

export const Route = createFileRoute("/projects/$projectId/settings")({
  component: ProjectSettings,
  staticData: { title: "Project Settings" },
})

function ProjectSettings(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId/settings" })
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)

  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const setAppState = useSetAppState()
  const navigate = useNavigate()

  const [name, setName] = useState(project?.name ?? "")
  const [projectPath, setProjectPath] = useState(project?.path ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (project) {
      setName(project.name)
      setProjectPath(project.path)
    }
  }, [project?.id])

  if (!project) return <p className="text-sm text-muted-foreground">Loading…</p>

  const isDirty = name !== project.name || projectPath !== project.path

  const handleSave = (): void => {
    updateProject.mutate(
      { id: projectId, name, path: projectPath },
      { onError: (err) => console.error("Failed to save project:", err) }
    )
  }

  const handleDelete = (): void => {
    deleteProject.mutate(
      { id: projectId },
      {
        onSuccess: () => {
          setAppState.mutate(
            { projectId: null },
            {
              onSuccess: () => void navigate({ to: "/" }),
              onError: (err) => console.error("Failed to clear active project:", err),
            }
          )
        },
        onError: (err) => console.error("Failed to delete project:", err),
      }
    )
  }

  return (
    <div className="flex max-w-md flex-col gap-8">
      <h1 className="text-xl font-semibold">Project Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">General</h2>
        <div className="flex flex-col gap-2">
          <label htmlFor="project-name" className="text-sm text-muted-foreground">Name</label>
          <input
            id="project-name"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="project-path" className="text-sm text-muted-foreground">Path</label>
          <input
            id="project-path"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={!isDirty || updateProject.isPending}
          onClick={handleSave}
        >
          {updateProject.isPending ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4">
        <h2 className="text-sm font-medium text-destructive">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          Deleting a project removes its folder and all associated data permanently.
        </p>
        {!confirmDelete ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            Delete project
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={deleteProject.isPending}
              onClick={handleDelete}
            >
              {deleteProject.isPending ? "Deleting…" : "Confirm delete"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
