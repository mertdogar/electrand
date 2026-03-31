import { contextBridge, ipcRenderer } from "electron"
import type { ElectrandBridge, PushPayloads } from "./bridge"

const bridge: ElectrandBridge = {
  invoke(channel, ...args) {
    return ipcRenderer.invoke(channel, args[0])
  },

  on(channel, callback) {
    const handler = (_event: Electron.IpcRendererEvent, data: PushPayloads[typeof channel]) =>
      callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}

contextBridge.exposeInMainWorld("__electrand", bridge)
