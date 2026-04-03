import React, { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { FolderOpen, Home, Info, Minus, Moon, Plus, Settings, Sun } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { trpc } from "@/trpc"

export function CommandPalette(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data: projects } = trpc.projects.list.useQuery()
  const { data: prefs } = trpc.preferences.get.useQuery()
  const setPrefs = trpc.preferences.set.useMutation()
  const setAppState = trpc.appState.set.useMutation()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function runAndClose(fn: () => void) {
    fn()
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                setAppState.mutate({ projectId: null })
                void navigate({ to: "/" })
              })
            }
          >
            <Home className="mr-2 h-4 w-4" />
            Home
            <CommandShortcut>⌘H</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                setAppState.mutate({ projectId: null })
                void navigate({ to: "/preferences" })
              })
            }
          >
            <Settings className="mr-2 h-4 w-4" />
            Preferences
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                setAppState.mutate({ projectId: null })
                void navigate({ to: "/about" })
              })
            }
          >
            <Info className="mr-2 h-4 w-4" />
            About
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Projects">
          {projects?.map((project) => (
            <CommandItem
              key={project.id}
              onSelect={() =>
                runAndClose(() => {
                  setAppState.mutate(
                    { projectId: project.id },
                    {
                      onSuccess: () =>
                        void navigate({
                          to: "/projects/$projectId",
                          params: { projectId: project.id },
                        }),
                    },
                  )
                })
              }
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {project.name}
            </CommandItem>
          ))}
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                setAppState.mutate({ projectId: null })
                void navigate({ to: "/" })
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Settings">
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                if (prefs) {
                  setPrefs.mutate({
                    theme: prefs.theme === "dark" ? "light" : "dark",
                  })
                }
              })
            }
          >
            {prefs?.theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            Toggle Theme
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                if (prefs && prefs.fontSize < 32) {
                  setPrefs.mutate({ fontSize: prefs.fontSize + 1 })
                }
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Increase Font Size
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAndClose(() => {
                if (prefs && prefs.fontSize > 8) {
                  setPrefs.mutate({ fontSize: prefs.fontSize - 1 })
                }
              })
            }
          >
            <Minus className="mr-2 h-4 w-4" />
            Decrease Font Size
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
