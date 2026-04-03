import React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FolderOpen } from "lucide-react"
import { trpc } from "@/trpc"
import { PageContent, PageSection, PageTitle } from "@/components/ui/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/preferences")({
  component: PreferencesScreen,
  staticData: { title: "Preferences" },
})

function PreferencesScreen(): React.ReactElement {
  const { data: prefs, isLoading } = trpc.preferences.get.useQuery()
  const setPrefs = trpc.preferences.set.useMutation()
  const selectDirectory = trpc.window.selectDirectory.useMutation()

  if (isLoading || !prefs) {
    return <p className="text-sm text-muted-foreground p-6">Loading…</p>
  }

  return (
    <PageContent narrow>
      <PageTitle>Preferences</PageTitle>

      <PageSection title="Appearance">
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm">Theme</span>
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setPrefs.mutate({ theme: prefs.theme === "dark" ? "light" : "dark" })}
            >
              {prefs.theme === "dark" ? "Dark" : "Light"}
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm">Font size</span>
            <div className="flex items-center gap-2">
              <button
                className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-accent disabled:opacity-40"
                onClick={() => setPrefs.mutate({ fontSize: prefs.fontSize - 1 })}
                disabled={prefs.fontSize <= 8}
              >
                −
              </button>
              <span className="w-10 text-center text-sm tabular-nums">{prefs.fontSize}px</span>
              <button
                className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-accent disabled:opacity-40"
                onClick={() => setPrefs.mutate({ fontSize: prefs.fontSize + 1 })}
                disabled={prefs.fontSize >= 32}
              >
                +
              </button>
            </div>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection title="Storage">
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">App data directory</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{prefs.appMainDirectory}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-4 shrink-0"
              onClick={async () => {
                const dir = await selectDirectory.mutateAsync()
                if (dir) setPrefs.mutate({ appMainDirectory: dir })
              }}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Change
            </Button>
          </CardContent>
        </Card>
      </PageSection>
    </PageContent>
  )
}
