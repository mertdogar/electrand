import React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Settings, Minus, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAppInfo } from "@/hooks/use-app-info"
import { useAppState } from "@/hooks/use-app-state"
import { useProjects } from "@/hooks/use-projects"
import { useWindowControls } from "@/hooks/use-window-controls"

export function Titlebar(): React.ReactElement {
  const { data: appInfo } = useAppInfo()
  const { data: appState } = useAppState()
  const { data: projects } = useProjects()
  const { minimize, maximizeToggle, close } = useWindowControls()
  const navigate = useNavigate()

  const platform = appInfo?.platform ?? ""
  const isDarwin = platform === "darwin"

  const project = appState?.projectId
    ? projects?.find((p) => p.id === appState.projectId)
    : null
  const centerTitle = project?.name ?? "Electrand"

  return (
    <header
      className="relative flex h-10 shrink-0 items-center border-b px-2"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left zone */}
      <div
        className="relative z-10 flex items-center gap-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {!isDarwin && <WindowControls minimize={minimize} maximizeToggle={maximizeToggle} close={close} />}
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
      </div>

      {/* Center zone — absolutely centered */}
      <div className="absolute inset-x-0 text-center text-sm font-medium select-none pointer-events-none">
        {centerTitle}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right zone */}
      <div
        className="relative z-10 flex items-center"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigate({ to: "/preferences" })}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}

function WindowControls({
  minimize,
  maximizeToggle,
  close,
}: {
  minimize: () => void
  maximizeToggle: () => void
  close: () => void
}): React.ReactElement {
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={minimize}
        className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-accent"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={maximizeToggle}
        className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-accent"
      >
        <Square className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={close}
        className="inline-flex h-8 w-10 items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
