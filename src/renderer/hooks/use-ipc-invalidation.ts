import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

export function useIpcInvalidation(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubs = [
      window.__electrand.on("app:preferences:changed", () => {
        void queryClient.invalidateQueries({ queryKey: ["preferences"] })
      }),
      window.__electrand.on("app:projects:changed", () => {
        void queryClient.invalidateQueries({ queryKey: ["projects"] })
      }),
      window.__electrand.on("app:appState:changed", () => {
        void queryClient.invalidateQueries({ queryKey: ["appState"] })
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [queryClient])
}
