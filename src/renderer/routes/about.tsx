import React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useAppInfo } from "@/hooks/use-app-info"
import { PageContent, PageMeta, PageTitle } from "@/components/ui/page"

export const Route = createFileRoute("/about")({
  component: AboutScreen,
  staticData: { title: "About" },
})

function AboutScreen(): React.ReactElement {
  const { data: info, isLoading } = useAppInfo()

  if (isLoading || !info) {
    return <p className="text-sm text-muted-foreground p-6">Loading…</p>
  }

  const rows: [string, string][] = [
    ["Version", info.version],
    ["Electron", info.versions.electron],
    ["Node", info.versions.node],
    ["Chrome", info.versions.chrome],
  ]

  return (
    <PageContent narrow>
      <PageTitle>{info.name}</PageTitle>
      <PageMeta rows={rows} />
    </PageContent>
  )
}
