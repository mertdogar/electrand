import React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { usePreferences, useSetPreferences } from "@/hooks/use-preferences"

export const Route = createFileRoute("/preferences")({
  component: PreferencesScreen,
  staticData: { title: "Preferences" },
})

function PreferencesScreen(): React.ReactElement {
  const { data: prefs, isLoading } = usePreferences()
  const setPrefs = useSetPreferences()

  if (isLoading || !prefs) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="text-xl font-semibold">Preferences</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Appearance</h2>
        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <span className="text-sm">Theme</span>
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() =>
              setPrefs.mutate({ theme: prefs.theme === "dark" ? "light" : "dark" })
            }
          >
            {prefs.theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <span className="text-sm">Font size</span>
          <div className="flex items-center gap-2">
            <button
              className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-accent"
              onClick={() => setPrefs.mutate({ fontSize: prefs.fontSize - 1 })}
              disabled={prefs.fontSize <= 8}
            >
              −
            </button>
            <span className="w-8 text-center text-sm">{prefs.fontSize}px</span>
            <button
              className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-accent"
              onClick={() => setPrefs.mutate({ fontSize: prefs.fontSize + 1 })}
              disabled={prefs.fontSize >= 32}
            >
              +
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Storage</h2>
        <div className="rounded-md border px-4 py-3">
          <p className="text-sm font-medium">App data directory</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {prefs.appMainDirectory}
          </p>
        </div>
      </section>
    </div>
  )
}
