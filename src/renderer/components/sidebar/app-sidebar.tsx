import React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { Layers } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/preferences", label: "Preferences" },
  { to: "/about", label: "About" },
] as const

export function AppSidebar(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sidebar>
      <SidebarHeader className="pt-8">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Layers className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Electrand</span>
                  <span className="text-xs text-muted-foreground">v1.0.0</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map(({ to, label }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild isActive={pathname === to}>
                  <Link to={to}>{label}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
