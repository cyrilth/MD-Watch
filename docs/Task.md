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
