import React from "react"
import { cn } from "@/lib/utils"

export function PageContent({
  children,
  narrow = false,
  className,
}: {
  children: React.ReactNode
  narrow?: boolean
  className?: string
}): React.ReactElement {
  return (
    <div className={cn("flex flex-col gap-8 px-6 py-6", narrow && "max-w-lg", className)}>
      {children}
    </div>
  )
}

export function PageTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <h1 className={cn("text-xl font-semibold tracking-tight", className)}>
      {children}
    </h1>
  )
}

export function PageSection({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {title && (
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

export function PageMeta({
  rows,
}: {
  rows: [string, string][]
}): React.ReactElement {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b last:border-0">
            <td className="py-2.5 text-muted-foreground">{label}</td>
            <td className="py-2.5 text-right font-mono text-xs">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
