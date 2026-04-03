import React, { useState, useEffect } from "react"
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { trpc } from "@/trpc"
import { PageContent, PageSection, PageTitle } from "@/components/ui/page"

export const Route = createFileRoute("/projects/$projectId/settings")({
  component: ProjectSettings,
  staticData: { title: "Project Settings" },
})

function ProjectSettings(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId/settings" })
  const { data: projects } = trpc.projects.list.useQuery()
  const project = projects?.find((p) => p.id === projectId)

  const updateProject = trpc.projects.update.useMutation()
  const deleteProject = trpc.projects.delete.useMutation()
  const setAppState = trpc.appState.set.useMutation()
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

  if (!project) return <p className="text-sm text-muted-foreground p-6">Loading…</p>

  const isDirty = name !== project.name || projectPath !== project.path

  const handleSave = (): void => {
    updateProject.mutate(
      { id: projectId, name, path: projectPath },
      { onError: (err) => console.error("Failed to save project:", err) },
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
            },
          )
        },
        onError: (err) => console.error("Failed to delete project:", err),
      },
    )
  }

  return (
    <PageContent narrow>
      <PageTitle>Project Settings</PageTitle>

      <PageSection title="General">
        <div className="flex flex-col gap-2">
          <label htmlFor="project-name" className="text-sm text-muted-foreground">
            Name
          </label>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="project-path" className="text-sm text-muted-foreground">
            Path
          </label>
          <Input
            id="project-path"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
          />
        </div>
        <Button size="sm" disabled={!isDirty || updateProject.isPending} onClick={handleSave}>
          {updateProject.isPending ? "Saving…" : "Save changes"}
        </Button>
      </PageSection>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Deleting a project removes its folder and all associated data permanently.
          </p>
          {!confirmDelete ? (
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
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
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContent>
  )
}
