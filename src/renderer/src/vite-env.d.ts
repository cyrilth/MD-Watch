/// <reference types="vite/client" />

interface Window {
  electron: {
    ping: () => Promise<string>
    openFile: () => Promise<{ path: string; content: string } | null>
    openFolder: () => Promise<string | null>
    listDirectory: (dirPath: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>
    readFile: (filePath: string) => Promise<string>
    watchFile: (filePath: string) => Promise<void>
    writeFile: (filePath: string, content: string) => Promise<void>
    getSession: () => Promise<Record<string, unknown>>
    setSession: (data: Record<string, unknown>) => Promise<void>
    exportSession: () => Promise<{ success: boolean; error?: string }>
    importSession: () => Promise<{ success: boolean; error?: string }>
    onFileChanged: (callback: (path: string, content: string) => void) => () => void
  }
}
