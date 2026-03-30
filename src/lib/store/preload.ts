/**
 * Preload-side of the electrand store.
 *
 * Exposes a single, generic IPC bridge that any renderer-side store hook
 * can talk through.  Call `exposeStoreApi()` once in your preload script.
 *
 * The bridge is store-agnostic — it doesn't need to know which stores exist.
 * Channel routing is handled by the store name baked into each IPC channel.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { channels, type ElectrandStoreBridge } from './types';

/**
 * Expose the store IPC bridge on `window.__electrand_store`.
 *
 * @example
 * ```ts
 * // src/preload.ts
 * import { exposeStoreApi } from './store/preload';
 * exposeStoreApi();
 * ```
 */
export function exposeStoreApi(): void {
  // Listener bookkeeping — contextBridge can't return functions, so we use
  // numeric IDs that the renderer can pass back to `unsubscribe`.
  let nextId = 0;
  const listeners = new Map<
    number,
    { channel: string; handler: (...args: unknown[]) => void }
  >();

  const bridge: ElectrandStoreBridge = {
    getState(name) {
      return ipcRenderer.invoke(channels.getState(name));
    },

    setState(name, partial) {
      return ipcRenderer.invoke(channels.setState(name), partial);
    },

    subscribe(name, callback) {
      const id = nextId++;
      const channel = channels.changed(name);
      const handler = (_event: unknown, state: unknown) => callback(state);

      ipcRenderer.on(channel, handler as never);
      listeners.set(id, { channel, handler });
      return id;
    },

    unsubscribe(listenerId) {
      const entry = listeners.get(listenerId);
      if (entry) {
        ipcRenderer.removeListener(entry.channel, entry.handler as never);
        listeners.delete(listenerId);
      }
    },
  };

  contextBridge.exposeInMainWorld('__electrand_store', bridge);
}
