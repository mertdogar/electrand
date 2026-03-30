/**
 * Core types for the electrand store system.
 *
 * State lives in the main process (zustand/vanilla).
 * Renderer gets a zustand React hook that syncs via IPC.
 * The same StoreDefinition is used by both sides.
 */

// ─── Utility types ───────────────────────────────────────────────────────────

/** Extracts only serializable (non-function) keys from T */
export type SerializableState<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K];
};

/** Extracts only function keys from T */
export type Actions<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? K : never]: T[K];
};

// ─── Store definition ────────────────────────────────────────────────────────

export type SetState<T> = (
  partial: Partial<T> | ((state: T) => Partial<T>),
) => void;

export type GetState<T> = () => T;

export type StateCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

export interface StoreDefinition<T> {
  readonly name: string;
  readonly creator: StateCreator<T>;
}

/**
 * Define a store that can be used in both main and renderer processes.
 *
 * @example
 * ```ts
 * const counterStore = defineStore('counter', (set, get) => ({
 *   count: 0,
 *   increment: () => set({ count: get().count + 1 }),
 *   reset: () => set({ count: 0 }),
 * }));
 * ```
 */
export function defineStore<T>(
  name: string,
  creator: StateCreator<T>,
): StoreDefinition<T> {
  return { name, creator };
}

// ─── IPC bridge (exposed by preload, consumed by renderer) ───────────────────

export interface ElectrandStoreBridge {
  getState: (name: string) => Promise<unknown>;
  setState: (name: string, partial: unknown) => Promise<void>;
  subscribe: (name: string, callback: (state: unknown) => void) => number;
  unsubscribe: (listenerId: number) => void;
}

// ─── IPC channel helpers ─────────────────────────────────────────────────────

const PREFIX = 'electrand:store';

export const channels = {
  getState: (name: string) => `${PREFIX}:${name}:get` as const,
  setState: (name: string) => `${PREFIX}:${name}:set` as const,
  changed: (name: string) => `${PREFIX}:${name}:changed` as const,
};

// ─── Serialisation helpers ───────────────────────────────────────────────────

export function stripFunctions<T extends object>(obj: T): SerializableState<T> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (typeof (obj as Record<string, unknown>)[key] !== 'function') {
      result[key] = (obj as Record<string, unknown>)[key];
    }
  }
  return result as SerializableState<T>;
}

// ─── Window augmentation ─────────────────────────────────────────────────────

declare global {
  interface Window {
    __electrand_store: ElectrandStoreBridge;
  }
}
