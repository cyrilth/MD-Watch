/**
 * Main process entry point.
 * Creates the app window, wires the preload script, loads the renderer, and handles IPC.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import {
  closeSessionDb,
  getSessionDbPath,
  readSessionFromDb,
  writeSessionToDb,
} from './session-db'

/** Compare two semver strings. Returns >0 if a>b, <0 if a<b, 0 if equal. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na !== nb) return na - nb
  }
  return 0
}

const PRELOAD_PATH = path.join(__dirname, '../preload/index.js')
const RENDERER_HTML_PATH = path.join(__dirname, '../renderer/index.html')

const MD_TXT_FILTER = [
  { name: 'Markdown & Text', extensions: ['md', 'txt'] },
  { name: 'All Files', extensions: ['*'] },
]

let mainWindow: BrowserWindow | null = null
let fileWatcher: { close: () => void } | null = null

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

  /** openFolder: directory picker, return selected path or null. */
  ipcMain.handle('openFolder', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  /** listDirectory(dirPath): return entries { name, path, isDirectory } for subdirs and .md/.txt files only. */
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
    const DEBOUNCE_MS = 150
    let changeTimeout: ReturnType<typeof setTimeout> | null = null
    watcher.on('change', () => {
      if (changeTimeout) clearTimeout(changeTimeout)
      changeTimeout = setTimeout(() => {
        changeTimeout = null
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          sendToRenderer('file-changed', filePath, content)
        } catch (err) {
          console.error('watchFile read error', err)
        }
      }, DEBOUNCE_MS)
    })
  })

  ipcMain.handle('unwatchFile', () => {
    if (fileWatcher) {
      fileWatcher.close()
      fileWatcher = null
    }
  })

  ipcMain.handle('writeFile', async (_event, filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, 'utf-8')
  })

  /** Save As: show save dialog, write content to chosen path, return { path } or null if canceled. */
  ipcMain.handle('saveFileAs', async (_event, content: string, defaultName?: string) => {
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, {
          defaultPath: defaultName ?? 'untitled.md',
          filters: MD_TXT_FILTER,
        })
      : await dialog.showSaveDialog({
          defaultPath: defaultName ?? 'untitled.md',
          filters: MD_TXT_FILTER,
        })
    if (result.canceled || !result.filePath) return null
    try {
      fs.writeFileSync(result.filePath, content, 'utf-8')
      return { path: result.filePath }
    } catch (err) {
      console.error('saveFileAs write error', err)
      return null
    }
  })

  /** Return the app version from package.json */
  ipcMain.handle('getAppVersion', () => {
    return app.getVersion()
  })

  /** Check GitHub Releases for a newer version. Returns { updateAvailable, latestVersion, downloadUrl, currentVersion } */
  ipcMain.handle('checkForUpdates', async () => {
    const currentVersion = app.getVersion()
    const owner = 'cyrilth'
    const repo = 'MD-Watch'
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const req = https.get(
          `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
          { headers: { 'User-Agent': 'MD-Watch-App' } },
          (res) => {
            if (res.statusCode === 404) {
              resolve(JSON.stringify({ tag_name: `v${currentVersion}`, html_url: '' }))
              return
            }
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              // follow redirect
              https.get(res.headers.location, { headers: { 'User-Agent': 'MD-Watch-App' } }, (r2) => {
                let body = ''
                r2.on('data', (chunk: Buffer) => (body += chunk.toString()))
                r2.on('end', () => resolve(body))
                r2.on('error', reject)
              }).on('error', reject)
              return
            }
            let body = ''
            res.on('data', (chunk: Buffer) => (body += chunk.toString()))
            res.on('end', () => resolve(body))
            res.on('error', reject)
          }
        )
        req.on('error', reject)
      })
      const release = JSON.parse(data) as { tag_name: string; html_url: string }
      const latestVersion = release.tag_name.replace(/^v/, '')
      const updateAvailable = compareVersions(latestVersion, currentVersion) > 0
      return {
        currentVersion,
        latestVersion,
        updateAvailable,
        downloadUrl: release.html_url || `https://github.com/${owner}/${repo}/releases`,
      }
    } catch (err) {
      console.error('checkForUpdates error', err)
      return { currentVersion, latestVersion: currentVersion, updateAvailable: false, downloadUrl: '', error: String(err) }
    }
  })

  /** Open an external URL in the default browser */
  ipcMain.handle('openExternal', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  /** Show a native context menu. The renderer sends a context string to pick the right menu.
   *  Actions are sent back to the renderer via 'menu-action'. */
  ipcMain.handle('showContextMenu', async (_event, context: string) => {
    if (!mainWindow) return

    let template: Electron.MenuItemConstructorOptions[] = []

    switch (context) {
      case 'editor':
        template = [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { type: 'separator' },
          { role: 'selectAll' },
        ]
        break

      case 'preview':
        template = [
          { role: 'copy' },
          { role: 'selectAll' },
        ]
        break

      case 'tab':
        template = [
          { label: 'Close Tab', click: () => sendToRenderer('menu-action', 'close-tab') },
          { label: 'Close Other Tabs', click: () => sendToRenderer('menu-action', 'close-other-tabs') },
          { label: 'Close All Tabs', click: () => sendToRenderer('menu-action', 'close-all-tabs') },
        ]
        break

      default:
        // General context menu
        template = [
          { label: 'New File', click: () => sendToRenderer('menu-action', 'new-file') },
          { label: 'Open File...', click: () => sendToRenderer('menu-action', 'open-file') },
          { label: 'Open Folder...', click: () => sendToRenderer('menu-action', 'open-folder') },
          { type: 'separator' },
          { role: 'copy' },
          { role: 'paste' },
          { type: 'separator' },
          { label: 'Toggle Kanban', click: () => sendToRenderer('menu-action', 'toggle-kanban') },
        ]
        break
    }

    const menu = Menu.buildFromTemplate(template)
    menu.popup({ window: mainWindow })
  })

  ipcMain.handle('getSession', () => {
    return readSessionFromDb()
  })

  ipcMain.handle('setSession', (_event, data: Record<string, unknown>) => {
    writeSessionToDb(data)
  })

  ipcMain.handle('exportSession', async () => {
    try {
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, {
            defaultPath: 'session.db',
            filters: [{ name: 'SQLite DB', extensions: ['db'] }, { name: 'All', extensions: ['*'] }],
          })
        : await dialog.showSaveDialog({
            defaultPath: 'session.db',
            filters: [{ name: 'SQLite DB', extensions: ['db'] }, { name: 'All', extensions: ['*'] }],
          })
      if (result.canceled || !result.filePath) return { success: false, error: 'Canceled' }
      fs.copyFileSync(getSessionDbPath(), result.filePath)
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
            filters: [{ name: 'SQLite DB', extensions: ['db'] }, { name: 'All', extensions: ['*'] }],
          })
        : await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'SQLite DB', extensions: ['db'] }, { name: 'All', extensions: ['*'] }],
          })
      if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Canceled' }
      const filePath = result.filePaths[0]
      const { createRequire } = await import('node:module')
      const require = createRequire(import.meta.url)
      const Database = require('better-sqlite3')
      const importedDb = new Database(filePath, { readonly: true })
      const rows = importedDb.prepare('SELECT key, value FROM session').all() as { key: string; value: string }[]
      importedDb.close()
      const merged: Record<string, unknown> = {}
      for (const row of rows) {
        try {
          merged[row.key] = JSON.parse(row.value)
        } catch {
          merged[row.key] = row.value
        }
      }
      writeSessionToDb(merged)
      sendToRenderer('session-imported')
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}

// ---------------------------------------------------------------------------
// Application menu
// ---------------------------------------------------------------------------

function sendMenuAction(action: string): void {
  sendToRenderer('menu-action', action)
}

function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          registerAccelerator: false,
          click: () => sendMenuAction('new-file'),
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          registerAccelerator: false,
          click: () => sendMenuAction('open-file'),
        },
        {
          label: 'Open Folder...',
          click: () => sendMenuAction('open-folder'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          registerAccelerator: false,
          click: () => sendMenuAction('save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          registerAccelerator: false,
          click: () => sendMenuAction('save-as'),
        },
        { type: 'separator' },
        {
          label: 'Refresh from Disk',
          accelerator: 'CmdOrCtrl+R',
          registerAccelerator: false,
          click: () => sendMenuAction('refresh'),
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          registerAccelerator: false,
          click: () => sendMenuAction('close-tab'),
        },
        {
          label: 'Close Session',
          click: () => sendMenuAction('close-session'),
        },
        { type: 'separator' },
        {
          label: 'Export Session...',
          click: () => sendMenuAction('export-session'),
        },
        {
          label: 'Import Session...',
          click: () => sendMenuAction('import-session'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // Edit
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },

    // View
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Editor',
          click: () => sendMenuAction('toggle-editor'),
        },
        {
          label: 'Toggle Preview',
          click: () => sendMenuAction('toggle-preview'),
        },
        {
          label: 'Toggle Kanban',
          accelerator: 'CmdOrCtrl+K',
          registerAccelerator: false,
          click: () => sendMenuAction('toggle-kanban'),
        },
        { type: 'separator' },
        {
          label: 'Light Theme',
          click: () => sendMenuAction('theme-light'),
        },
        {
          label: 'Dark Theme',
          click: () => sendMenuAction('theme-dark'),
        },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },

    // Help
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'F1',
          registerAccelerator: false,
          click: () => sendMenuAction('show-help'),
        },
        {
          label: 'Kanban Instructions',
          click: () => sendMenuAction('show-kanban-instructions'),
        },
        { type: 'separator' },
        {
          label: 'About MD-Watch',
          click: () => sendMenuAction('show-about'),
        },
        {
          label: 'Check for Updates...',
          click: () => sendMenuAction('check-updates'),
        },
        { type: 'separator' },
        {
          label: 'GitHub Repository',
          click: () => shell.openExternal('https://github.com/cyrilth/MD-Watch'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow(): void {
  // Icon for title bar and taskbar. Windows uses .ico (multi-size) to avoid squish and small/top-aligned taskbar icon.
  const assetsDir = path.join(app.getAppPath(), 'assets')
  const iconPath =
    process.platform === 'win32'
      ? path.join(assetsDir, 'md-watch-logo.ico')
      : path.join(assetsDir, 'md-watch-logo.png')
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'MD-Watch',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // Content-Security-Policy: only when packaged to avoid dev (e.g. Vite HMR) breakage
  if (app.isPackaged) {
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp],
        },
      })
    })
  }

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
  buildAppMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  closeSessionDb()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
