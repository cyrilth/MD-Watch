/**
 * Main process entry point.
 * Creates the app window, wires the preload script, loads the renderer, and handles IPC.
 */
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const PRELOAD_PATH = path.join(__dirname, '../preload/index.js')
const RENDERER_HTML_PATH = path.join(__dirname, '../renderer/index.html')

const MD_TXT_FILTER = [
  { name: 'Markdown & Text', extensions: ['md', 'txt'] },
  { name: 'All Files', extensions: ['*'] },
]

let mainWindow: BrowserWindow | null = null
let fileWatcher: { close: () => void } | null = null

function getSessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json')
}

function readSession(): Record<string, unknown> {
  try {
    const data = fs.readFileSync(getSessionPath(), 'utf-8')
    return JSON.parse(data) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeSession(data: Record<string, unknown>): void {
  const dir = path.dirname(getSessionPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getSessionPath(), JSON.stringify(data, null, 2), 'utf-8')
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle('ping', () => 'pong')

  /** Open file: dialog (filter .md, .txt), read utf-8 without locking, return path + content. */
  ipcMain.handle('openFile', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: MD_TXT_FILTER })
      : await dialog.showOpenDialog({ properties: ['openFile'], filters: MD_TXT_FILTER })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { path: filePath, content }
    } catch (err) {
      console.error('openFile read error', err)
      return null
    }
  })

  ipcMain.handle('openFolder', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('listDirectory', async (_event, dirPath: string) => {
    const entries: { name: string; path: string; isDirectory: boolean }[] = []
    try {
      const names = fs.readdirSync(dirPath, { withFileTypes: true })
      for (const dirent of names) {
        const fullPath = path.join(dirPath, dirent.name)
        if (dirent.isDirectory()) {
          entries.push({ name: dirent.name, path: fullPath, isDirectory: true })
        } else {
          const ext = path.extname(dirent.name).toLowerCase()
          if (ext === '.md' || ext === '.txt') {
            entries.push({ name: dirent.name, path: fullPath, isDirectory: false })
          }
        }
      }
    } catch (err) {
      console.error('listDirectory error', err)
    }
    return entries
  })

  ipcMain.handle('readFile', async (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8')
  })

  /** Watch single file (chokidar); on change read file and send file-changed to renderer.
   * Stops the previous watcher when opening a new file (one active watcher at a time). */
  ipcMain.handle('watchFile', async (_event, filePath: string) => {
    if (fileWatcher) {
      fileWatcher.close()
      fileWatcher = null
    }
    const chokidar = await import('chokidar')
    const watcher = chokidar.default.watch(filePath, { persistent: true })
    fileWatcher = watcher
    watcher.on('change', () => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        sendToRenderer('file-changed', filePath, content)
      } catch (err) {
        console.error('watchFile read error', err)
      }
    })
  })

  ipcMain.handle('writeFile', async (_event, filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, 'utf-8')
  })

  ipcMain.handle('getSession', () => {
    return readSession()
  })

  ipcMain.handle('setSession', (_event, data: Record<string, unknown>) => {
    const current = readSession()
    writeSession({ ...current, ...data })
  })

  ipcMain.handle('exportSession', async () => {
    try {
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, {
            defaultPath: 'session.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
          })
        : await dialog.showSaveDialog({
            defaultPath: 'session.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
          })
      if (result.canceled || !result.filePath) return { success: false, error: 'Canceled' }
      const data = readSession()
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('importSession', async () => {
    try {
      const result = mainWindow
        ? await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'All', extensions: ['*'] }],
          })
        : await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'All', extensions: ['*'] }],
          })
      if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Canceled' }
      const filePath = result.filePaths[0]
      const raw = fs.readFileSync(filePath, 'utf-8')
      const imported = JSON.parse(raw) as Record<string, unknown>
      const current = readSession()
      writeSession({ ...current, ...imported })
      sendToRenderer('session-imported')
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'MD-Watch',
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      sandbox: true,
    },
  })

  mainWindow = win
  win.on('closed', () => {
    mainWindow = null
    if (fileWatcher) {
      fileWatcher.close()
      fileWatcher = null
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(RENDERER_HTML_PATH)
  }
}

app.whenReady().then(() => {
  setupIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
