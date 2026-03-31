export function useWindowControls() {
  return {
    minimize: () => window.__electrand.invoke("app:window:minimize"),
    maximizeToggle: () => window.__electrand.invoke("app:window:maximize-toggle"),
    close: () => window.__electrand.invoke("app:window:close"),
  }
}
