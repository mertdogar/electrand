/**
 * Main-process side of the electrand store.
 *
 * Creates a zustand vanilla store and wires up IPC handlers so every
 * renderer window can read, write, and subscribe to state changes.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { ipcMain, BrowserWindow, app } from 'electron';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  type StoreDefinition,
  type SerializableState,
  channels,
  stripFunctions,
} from './types';

export interface MainStoreOptions {
  /** Persist state to disk. Defaults to `true`. */
  persist?: boolean;
  /**
   * Custom file path for the persisted JSON.
   * Defaults to `<userData>/stores/<name>.json`.
   */
  persistPath?: string;
}

/**
 * Instantiate a store in the main process and register its IPC handlers.
 *
 * Call this once per store, before any BrowserWindow is created (typically
 * right after `app.whenReady()`).
 *
 * @returns The underlying zustand vanilla StoreApi — useful if main-process
 *          code needs to read/write the store directly.
 *
 * @example
 * ```ts
 * // src/main.ts
 * import { createMainStore } from './store/main';
 * import { preferencesStore } from './stores/preferences';
 *
 * app.whenReady().then(() => {
 *   createMainStore(preferencesStore);
 *   createWindow();
 * });
 * ```
 */
export function createMainStore<T extends object>(
  definition: StoreDefinition<T>,
  options: MainStoreOptions = {},
): StoreApi<T> {
  const { persist = true } = options;

  // ── Persistence paths ──────────────────────────────────────────────────
  const filePath =
    options.persistPath ??
    path.join(app.getPath('userData'), 'stores', `${definition.name}.json`);

  // ── Load persisted state from disk ─────────────────────────────────────
  let persisted: Partial<T> | undefined;
  if (persist) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      persisted = JSON.parse(raw) as Partial<T>;
    } catch {
      // File doesn't exist yet or is corrupt — start fresh
    }
  }

  // Create the real zustand store
  const store = createStore<T>((set, get) =>
    definition.creator(
      // Narrow zustand's set to our SetState<T> (no `replace` param)
      (partial) => {
        const resolved =
          typeof partial === 'function' ? partial(get()) : partial;
        set(resolved as Partial<T>);
      },
      get,
    ),
  );

  // Apply persisted state on top of defaults (if any was loaded)
  if (persisted) {
    store.setState(persisted);
  }

  // ── IPC: get current (serialisable) state ──────────────────────────────
  ipcMain.handle(channels.getState(definition.name), () =>
    stripFunctions(store.getState()),
  );

  // ── IPC: apply a partial state update ──────────────────────────────────
  ipcMain.handle(
    channels.setState(definition.name),
    (_event, partial: Partial<SerializableState<T>>) => {
      store.setState(partial as Partial<T>);
    },
  );

  // ── Broadcast every state change to all renderer windows ───────────────
  const channel = channels.changed(definition.name);

  store.subscribe((state) => {
    const serializable = stripFunctions(state);

    // Persist to disk
    if (persist) {
      try {
        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, JSON.stringify(serializable, null, 2));
      } catch {
        // Non-fatal — log in dev if needed
      }
    }

    // Broadcast to renderers
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, serializable);
      }
    }
  });

  return store;
}
