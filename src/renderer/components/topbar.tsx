import React from "react"
import { useRouterState } from "@tanstack/react-router"

export function Topbar(): React.ReactElement {
  const matches = useRouterState({ select: (s) => s.matches })
  const title = [...matches]
    .reverse()
    .find((m) => (m.staticData as { title?: string }).title)
  const label = (title?.staticData as { title?: string })?.title ?? ""

  return (
    <header className="flex h-10 shrink-0 items-center border-b px-4">
      <span className="text-sm font-medium">{label}</span>
    </header>
  )
}
