import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Preferences } from "@shared/schemas"

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () => window.__electrand.invoke("app:preferences:get"),
  })
}

export function useSetPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<Preferences>) =>
      window.__electrand.invoke("app:preferences:set", partial),
    onSuccess: (data) => {
      queryClient.setQueryData(["preferences"], data)
    },
  })
}
