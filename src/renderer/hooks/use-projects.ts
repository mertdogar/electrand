import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => window.__electrand.invoke("app:projects:get"),
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; path: string }) =>
      window.__electrand.invoke("app:projects:create", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string } & Partial<{ name: string; path: string }>) =>
      window.__electrand.invoke("app:projects:update", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string }) => window.__electrand.invoke("app:projects:delete", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}
