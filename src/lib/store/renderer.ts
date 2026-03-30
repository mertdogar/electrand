/**
 * Renderer-side of the electrand store.
 *
 * Creates a zustand React hook whose `set` goes through IPC to the main
 * process.  State changes broadcast from main are merged into the local
 * zustand store so every React component re-renders exactly like a normal
 * zustand hook.
 *
 * Usage is identical to zustand — selectors, shallow equality, everything
 * works out of the box.
 */
import { create } from 'zustand';
import { type StoreDefinition, stripFunctions } from './types';

/**
 * Create a zustand React hook backed by a main-process store.
 *
 * The returned hook has the exact same API as `zustand/create`:
 *   - `useStore(selector)` — subscribe to a slice
 *   - `useStore.getState()` — read outside React
 *   - `useStore.setState()` — write outside React (goes through IPC)
 *   - `useStore.subscribe()` — subscribe outside React
 *
 * @example
 * ```tsx
 * import { createStoreHook } from '../store/renderer';
 * import { preferencesStore } from '../stores/preferences';
 *
 * const usePreferences = createStoreHook(preferencesStore);
 *
 * function ThemeToggle() {
 *   const theme = usePreferences((s) => s.theme);
 *   const setTheme = usePreferences((s) => s.setTheme);
 *   return <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme}</button>;
 * }
 * ```
 */
export function createStoreHook<T extends object>(definition: StoreDefinition<T>) {
  const bridge = window.__electrand_store;

  const useStore = create<T>((zustandSet, zustandGet) => {
    // ── IPC-backed set: resolves updaters locally, sends data to main ────
    const ipcSet = (
      partial: Partial<T> | ((state: T) => Partial<T>),
    ): void => {
      const resolved =
        typeof partial === 'function' ? partial(zustandGet()) : partial;

      // Strip functions before sending over IPC (actions aren't serialisable)
      const data = stripFunctions(resolved as Record<string, unknown>);

      // Optimistic local update (keeps the UI snappy)
      zustandSet(resolved as Partial<T>);

      // Persist to main — main will broadcast to other windows
      bridge.setState(definition.name, data);
    };

    // Run the creator with our IPC-backed set to build initial state + actions
    const initialState = definition.creator(ipcSet, zustandGet);

    // ── Subscribe to broadcasts from main (covers cross-window sync) ─────
    bridge.subscribe(definition.name, (mainState) => {
      // Shallow-merge data from main; action functions in local state survive
      zustandSet(mainState as Partial<T>);
    });

    // ── Hydrate: pull the latest state from main (async) ─────────────────
    bridge.getState(definition.name).then((mainState) => {
      if (mainState && typeof mainState === 'object') {
        zustandSet(mainState as Partial<T>);
      }
    });

    return initialState;
  });

  // Also override the external `setState` so imperative callers go through IPC
  const originalSetState = useStore.setState.bind(useStore);
  useStore.setState = (partial, replace) => {
    const resolved =
      typeof partial === 'function'
        ? partial(useStore.getState())
        : partial;

    const data = stripFunctions(resolved as Record<string, unknown>);

    // Local update
    originalSetState(resolved as Partial<T>, replace as false);

    // Sync to main
    bridge.setState(definition.name, data);
  };

  return useStore;
}
