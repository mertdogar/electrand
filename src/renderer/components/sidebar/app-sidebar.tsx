import React from "react"
import { Link } from "@tanstack/react-router"
import { Home, Settings, Info } from "lucide-react"

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/preferences", label: "Preferences", icon: Settings },
  { to: "/about", label: "About", icon: Info },
] as const

export function AppSidebar(): React.ReactElement {
  return (
    <nav className="flex h-full flex-col gap-1 p-2">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent [&.active]:bg-accent [&.active]:font-medium"
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
