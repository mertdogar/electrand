import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AppState } from "@shared/schemas"

export function useAppState() {
  return useQuery({
    queryKey: ["appState"],
    queryFn: () => window.__electrand.invoke("app:appState:get"),
  })
}

export function useSetAppState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<AppState>) =>
      window.__electrand.invoke("app:appState:set", partial),
    onSuccess: (data) => {
      queryClient.setQueryData(["appState"], data)
    },
  })
}
