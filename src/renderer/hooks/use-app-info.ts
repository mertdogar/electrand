import { useQuery } from "@tanstack/react-query"

export function useAppInfo() {
  return useQuery({
    queryKey: ["appInfo"],
    queryFn: () => window.__electrand.invoke("app:info:get"),
    staleTime: Infinity, // app info never changes at runtime
  })
}
