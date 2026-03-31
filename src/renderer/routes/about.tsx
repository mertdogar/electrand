import React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useAppInfo } from "@/hooks/use-app-info"

export const Route = createFileRoute("/about")({
  component: AboutScreen,
  staticData: { title: "About" },
})

function AboutScreen(): React.ReactElement {
  const { data: info, isLoading } = useAppInfo()

  if (isLoading || !info) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  const rows: [string, string][] = [
    ["Version", info.version],
    ["Electron", info.versions.electron],
    ["Node", info.versions.node],
    ["Chrome", info.versions.chrome],
  ]

  return (
    <div className="flex max-w-sm flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">{info.name}</h1>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="last:border-0">
              <td className="py-2 text-muted-foreground">{label}</td>
              <td className="py-2 text-right font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
