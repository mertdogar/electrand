import React from "react"
import { useRouterState } from "@tanstack/react-router"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function Topbar(): React.ReactElement {
  const matches = useRouterState({ select: (s) => s.matches })
  const title = [...matches].reverse().find((m) => (m.staticData as { title?: string }).title)
  const label = (title?.staticData as { title?: string })?.title ?? ""

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <span className="text-sm font-medium">{label}</span>
    </header>
  )
}
