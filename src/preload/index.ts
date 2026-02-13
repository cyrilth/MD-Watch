/**
 * Preload script: runs in an isolated context before the renderer loads.
 * Uses contextBridge to expose a minimal, safe API to the renderer (no direct Node/Electron APIs).
 */
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  ping: () => ipcRenderer.invoke('ping'),

  // File & folder (main will implement handlers in later tasks)
  openFile: () => ipcRenderer.invoke('openFile'),
  openFolder: () => ipcRenderer.invoke('openFolder'),
  listDirectory: (dirPath: string) => ipcRenderer.invoke('listDirectory', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('readFile', filePath),
  watchFile: (filePath: string) => ipcRenderer.invoke('watchFile', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('writeFile', filePath, content),

  // Session
  getSession: () => ipcRenderer.invoke('getSession'),
  setSession: (data: Record<string, unknown>) => ipcRenderer.invoke('setSession', data),
  exportSession: () => ipcRenderer.invoke('exportSession'),
  importSession: () => ipcRenderer.invoke('importSession'),

  // Subscribe to file changes (main sends 'file-changed' with path + content)
  onFileChanged: (callback: (path: string, content: string) => void) => {
    const handler = (_: unknown, path: string, content: string) => callback(path, content)
    ipcRenderer.on('file-changed', handler)
    return () => ipcRenderer.removeListener('file-changed', handler)
  },
})
