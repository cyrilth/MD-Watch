/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}

interface Window {
  electron: {
    ping: () => Promise<string>
    openFile: () => Promise<{ path: string; content: string } | null>
    openFolder: () => Promise<string | null>
    listDirectory: (dirPath: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>
    readFile: (filePath: string) => Promise<string>
    watchFile: (filePath: string) => Promise<void>
    unwatchFile: () => Promise<void>
    writeFile: (filePath: string, content: string) => Promise<void>
    saveFileAs: (content: string, defaultName?: string) => Promise<{ path: string } | null>
    showContextMenu: (context: string) => Promise<void>
    getAppVersion: () => Promise<string>
    checkForUpdates: () => Promise<{
      currentVersion: string
      latestVersion: string
      updateAvailable: boolean
      downloadUrl: string
      error?: string
    }>
    openExternal: (url: string) => Promise<void>
    getSession: () => Promise<Record<string, unknown>>
    setSession: (data: Record<string, unknown>) => Promise<void>
    exportSession: () => Promise<{ success: boolean; error?: string }>
    importSession: () => Promise<{ success: boolean; error?: string }>
    onFileChanged: (callback: (path: string, content: string) => void) => () => void
    onSessionImported: (callback: () => void) => () => void
    onMenuAction: (callback: (action: string) => void) => () => void
  }
}
