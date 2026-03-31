import type { Preferences, Project, AppState, AppInfo } from "@shared/schemas"

export interface InvokePayloads {
  "app:preferences:get": void
  "app:preferences:set": Partial<Preferences>
  "app:projects:get": void
  "app:projects:create": { name: string; path: string }
  "app:projects:update": { id: string } & Partial<{ name: string; path: string }>
  "app:projects:delete": { id: string }
  "app:appState:get": void
  "app:appState:set": Partial<AppState>
  "app:info:get": void
}

export interface InvokeReturns {
  "app:preferences:get": Preferences
  "app:preferences:set": Preferences
  "app:projects:get": Project[]
  "app:projects:create": Project
  "app:projects:update": Project
  "app:projects:delete": void
  "app:appState:get": AppState
  "app:appState:set": AppState
  "app:info:get": AppInfo
}

export interface PushPayloads {
  "app:preferences:changed": Preferences
  "app:projects:changed": Project[]
  "app:appState:changed": AppState
}

export interface ElectrandBridge {
  invoke<C extends keyof InvokePayloads>(
    channel: C,
    ...args: InvokePayloads[C] extends void ? [] : [InvokePayloads[C]]
  ): Promise<InvokeReturns[C]>

  on<C extends keyof PushPayloads>(
    channel: C,
    callback: (data: PushPayloads[C]) => void,
  ): () => void
}

declare global {
  interface Window {
    __electrand: ElectrandBridge
  }
}
