# MD Watch — Task List

Use this file to track implementation. Check off tasks as they are completed.

---

## Phase 1: Previewer, hot reload, scroll, folder view

### Setup and shell

- [x] **1.1** Initialize Electron project (electron-vite or Electron Forge + Vite)
- [x] **1.2** Add React (or Vue) and configure renderer build
- [x] **1.3** Create main process entry: window, preload path
- [x] **1.4** Create preload script with contextBridge
- [x] **1.5** Expose IPC API: `openFile`, `openFolder`, `listDirectory`, `readFile`, `watchFile`, `writeFile`, `getSession`, `setSession`, `exportSession`, `importSession`

### File open and watch

- [x] **1.6** Implement `openFile`: dialog (filter .md, .txt), read file (utf-8, no lock), return path + content
- [x] **1.7** Add chokidar: watch single file on path selection; on `change` read file and send `file-changed` to renderer
- [x] **1.8** Stop previous watcher when opening a new file

### Editor + preview UI

- [x] **1.9** Layout: two panels (editor | preview), resizable if desired
- [x] **1.10** Editor: CodeMirror 6; display current file content; accept updates from `file-changed`
- [x] **1.11** Preview for .md: integrate marked or markdown-it; render content to HTML in scrollable container
- [x] **1.12** Preview for .txt: render plain text (e.g. pre-wrap) in scrollable container
- [x] **1.13** Sync: on file load and on `file-changed`, update editor and preview

### Scroll position on hot reload

- [x] **1.14** Before applying new content, save preview scrollTop and scrollHeight (or ratio)
- [x] **1.15** After rendering new content, restore scroll (absolute or ratio-based)
- [x] **1.16** Ensure restore only happens on hot-reload path, not on first load or user scroll

### Mermaid (Markdown only)

- [x] **1.17** Add mermaid dependency (renderer)
- [x] **1.18** In markdown pipeline, detect fenced code blocks with language `mermaid`
- [x] **1.19** Replace each block with a container element (e.g. `div.mermaid`); call `mermaid.run()` on those nodes to render diagrams (use current Mermaid docs for run options)
- [x] **1.20** Re-run Mermaid on file change so diagrams update on hot reload

### Folder view

- [x] **1.21** Main: `openFolder()` — directory picker, return path
- [x] **1.22** Main: `listDirectory(dirPath)` — return list of entries: { name, path, isDirectory } for subdirs and files with .md or .txt only
- [x] **1.23** Renderer: FolderView component — tree UI (root = opened folder)
- [x] **1.24** Tree: directories expandable; list .md/.txt and subdirs per directory
- [x] **1.25** Click file in tree: open file (same as Open file), start watching
- [x] **1.26** Persist `lastOpenedFolder` in session; restore folder view on app load when present

---

## Phase 2: Kanban (bidirectional)

### Selection and parsing

- [x] **2.1** Editor: track selection (CodeMirror 6 API); store kanban region `{ start, end }` (and file path)
- [x] **2.2** Parser: given selected text, split by any heading line (`#`, `##`, `###`, etc.) → columns; within each block parse `-` / `*` list items → cards
- [x] **2.3** Re-parse on file content change and on selection change; update internal kanban state

### Kanban UI

- [x] **2.4** Add DnD library (e.g. @dnd-kit)
- [x] **2.5** Render columns as lanes, items as draggable cards
- [x] **2.6** On card drop to another column: compute new markdown (move list item between heading blocks), replace selected region in full content
- [x] **2.7** Call `writeFile` with full content; handle watcher firing and re-sync (preserve scroll)

### Edge cases

- [x] **2.8** If selection range invalid (e.g. file shortened): clear or disable kanban, optional message
- [x] **2.9** Debounce or coalesce chokidar change events to avoid double reload

---

## Phase 3: Session DB and import/export

### SQLite session

- [x] **3.1** Add better-sqlite3 (or sql.js) in main process
- [x] **3.2** Create DB file (e.g. in user data dir); create table(s) for session (e.g. key/value or normalized)
- [x] **3.3** Implement getSession: read from DB, return object (lastFilePath, lastOpenedFolder, scroll, kanban selection, etc.)
- [x] **3.4** Implement setSession(data): write to DB
- [x] **3.5** Wire session restore on app load: restore last opened file (if readable), last opened folder, scroll, kanban selection; do not persist or restore folder tree expand/collapse state
- [x] **3.6** Call setSession when user opens file, changes scroll, sets kanban selection, opens folder

### Import / export (raw .db)

- [x] **3.7** Export: menu/UI “Export data” → main shows save dialog (default session.db) → copy current DB file to chosen path; return success/error to renderer
- [x] **3.8** Import: menu/UI “Import data” → main shows open dialog for .db → merge keys from selected .db into current session DB (imported values override for same keys), notify renderer to reload session
- [x] **3.9** Renderer: show success or error toast/message after export/import
- [x] **3.10** Preload: exportSession(), importSession() (dialogs in main)

---

## Polish and optional

- [x] **4.1** Optional: lazy-load folder tree (list directory on expand)
- [x] **4.2** Optional: “Refresh” button for folder view to re-scan current folder

---

## UI: Logo, hide panels, theme

### Logo

- [x] **5.1** Add MD-Li logo image; show in app header
- [x] **5.2** Set window icon in main process (title bar and taskbar); use multi-size .ico on Windows (assets/md-watch-logo.ico)

### Hide editor / hide preview

- [x] **5.3** Header checkboxes: “Hide editor”, “Hide preview”; when one checked, that panel hidden and the other full-width; when both checked, show placeholder message

### Dark and light theme

- [x] **5.4** CSS variables for all UI colors; dark overrides under `.app[data-theme="dark"]`
- [x] **5.5** Theme state (light | dark); header select “Light” / “Dark”; persist theme in session and restore on load
- [x] **5.6** CodeMirror editor: use component `theme` prop (`'light'` / `'dark'`) so editor matches app theme

---

## Tabs, new file, save, refresh

### Tab system

- [x] **6.1** `Tab` type: `{ id, filePath, content, kanbanRegion }`. State: `tabs[]` and `activeTabId`
- [x] **6.2** Tab bar UI (VS Code–style): show open tabs; click to switch, × to close
- [x] **6.3** `openFileInTab`: reuse existing tab for same path or create new tab
- [x] **6.4** `switchTab`: set active tab and update file watcher
- [x] **6.5** `closeTab`: remove tab, switch to adjacent tab, unwatch if needed
- [x] **6.6** Persist `openTabs` and `activeTabIndex` in session; restore on app load

### New file

- [x] **6.7** `handleNewFile`: create blank untitled tab (`filePath: null`, empty content)
- [x] **6.8** Header "New file" button; `Ctrl+N` keyboard shortcut
- [x] **6.9** Untitled tabs default to markdown rendering in preview
- [x] **6.10** On first launch or empty session, start with a blank untitled tab

### Save / Save As

- [x] **6.11** Main process: `saveFileAs` IPC handler using `dialog.showSaveDialog`; writes content and returns `{ path }`
- [x] **6.12** `handleSave`: write to existing `filePath` or prompt save dialog for untitled files; `Ctrl+S`
- [x] **6.13** `handleSaveAs`: always prompt save dialog; update tab's `filePath` and start watcher; `Ctrl+Shift+S`

### Refresh

- [x] **6.14** `handleRefreshFile`: re-read file from disk; update active tab content; preserve kanban region if still valid; restore scroll position; `Ctrl+R`

### Close session

- [x] **6.15** `handleCloseSession`: reset all state and create a fresh blank untitled tab so editor stays usable

---

## Kanban toggle and instructions

- [x] **7.1** `showKanban` state (default off); header "Kanban" toggle button with active highlight; `Ctrl+K` shortcut
- [x] **7.2** Kanban section (board or instructions) only rendered when toggled on
- [x] **7.3** Kanban instruction modal: "Instructions" button opens modal with usage guide and copyable sample markdown format

---

## Keyboard shortcuts and Help

- [x] **8.1** Global keyboard handler: `Ctrl+N`, `Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+S`, `Ctrl+R`, `Ctrl+W`, `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl+K`, `F1`
- [x] **8.2** Header "Help" button and `F1` toggle a styled modal listing all shortcuts in a table with `<kbd>` elements
- [x] **8.3** Help modal styled with theme-aware CSS (light/dark); shares overlay/card styling with kanban instruction modal

---

## About, versioning, and auto-update

### Versioning

- [x] **9.1** Set meaningful version in `package.json` (`1.0.0`); add `repository` field and `author`
- [x] **9.2** Main process: `getAppVersion` IPC handler returning `app.getVersion()`
- [x] **9.3** Preload: expose `getAppVersion`, `checkForUpdates`, `openExternal`
- [x] **9.4** Renderer: fetch version on mount; display in About modal

### About modal

- [x] **9.5** Header "About" button opens modal with logo, version, description, GitHub link, and update check section
- [x] **9.6** Styled About modal CSS (theme-aware); download button for available updates

### Check for updates

- [x] **9.7** Main process: `checkForUpdates` IPC handler queries GitHub Releases API (`/repos/cyrilth/MD-Watch/releases/latest`)
- [x] **9.8** Semver comparison helper (`compareVersions`); returns `{ currentVersion, latestVersion, updateAvailable, downloadUrl }`
- [x] **9.9** Main process: `openExternal` IPC handler using `shell.openExternal` for download link
- [x] **9.10** Renderer: "Check for updates" button with loading/result states; "Download latest" button when update available

### CI/CD — GitHub Actions

- [x] **9.11** Add `electron-builder` dev dependency and `build` config in `package.json` (appId, targets for win/mac/linux, icons, NSIS options)
- [x] **9.12** Add `pack`, `dist`, and `release` npm scripts
- [x] **9.13** Create `.github/workflows/release.yml`: triggered on `v*` tags; matrix build (windows, linux, macos); electron-builder packaging; artifact upload; GitHub Release via `softprops/action-gh-release`

---

## Application menu and context menus

### Custom application menu

- [x] **10.1** Import `Menu` from Electron; build custom menu template with File, Edit, View, Help submenus
- [x] **10.2** Menu items send `menu-action` IPC events to the renderer via `sendToRenderer`
- [x] **10.3** Use `registerAccelerator: false` on items with shortcuts handled by the renderer to avoid double-firing
- [x] **10.4** Call `buildAppMenu()` in `app.whenReady()` to set the application menu on startup

### Right-click context menus

- [x] **10.5** Main process: `showContextMenu` IPC handler builds context-specific menus and shows them via `Menu.popup()`
- [x] **10.6** Four context types: `editor` (Undo/Redo/Cut/Copy/Paste/Select All), `preview` (Copy/Select All), `tab` (Close Tab/Close Other Tabs/Close All Tabs), `general` (New File/Open File/Open Folder/Copy/Paste/Toggle Kanban)
- [x] **10.7** Preload: expose `showContextMenu(context)` IPC call
- [x] **10.8** Renderer: global `contextmenu` event listener detects click target (`.cm-editor`, `.preview-panel`, `.tab-bar`, or general) and calls `showContextMenu`
- [x] **10.9** Tab context menu uses `contextTabIdRef` to track which tab was right-clicked; `close-tab` from context menu closes the right-clicked tab
- [x] **10.10** `close-other-tabs`: keeps only the right-clicked tab; `close-all-tabs`: closes everything and opens a blank untitled tab
- [x] **10.11** All context menu actions routed through the existing `onMenuAction` handler in `App.tsx`
