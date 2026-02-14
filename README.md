# MD-Watch

[![Build & Release](https://github.com/cyrilth/MD-Watch/actions/workflows/release.yml/badge.svg)](https://github.com/cyrilth/MD-Watch/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/v/tag/cyrilth/MD-Watch?label=version&sort=semver)](https://github.com/cyrilth/MD-Watch/releases)

A desktop app to preview Markdown and plain text with hot reload, Mermaid diagrams, a folder view, and a bidirectional kanban board driven by selected text. Built with Electron to learn the stack.

## Download & Install

Pre-built installers are available on the [Releases](https://github.com/cyrilth/MD-Watch/releases) page.

| Platform | File | How to install |
| --- | --- | --- |
| **Windows** | `MD-Watch Setup <version>.exe` | Run the installer and follow the prompts. Optionally choose a custom install directory. |
| **Windows** (portable) | `MD-Watch-<version>-win.zip` | Extract the zip anywhere and run `MD-Watch.exe`. No installation required. |
| **macOS** | `MD-Watch-<version>.dmg` | Open the DMG and drag **MD-Watch** into your Applications folder. |
| **macOS** (portable) | `MD-Watch-<version>-mac.zip` | Extract and run **MD-Watch.app**. |
| **Linux** | `MD-Watch-<version>.AppImage` | Make it executable (`chmod +x MD-Watch-*.AppImage`) and run it. Works on most distros. |
| **Linux** (Debian/Ubuntu) | `md-watch_<version>_amd64.deb` | Install with `sudo dpkg -i md-watch_*.deb`. |

> **Tip**: Inside the app, click **About** then **Check for updates** to see if a newer release is available, with a one-click download link.

> **Note (Windows):** The installer is not code-signed. Windows SmartScreen may show an "unknown publisher" warning — click **More info** then **Run anyway** to proceed. This is expected for unsigned open-source apps.

## Features

- **Tabs**: Open multiple files in tabs (VS Code–style tab bar); switch, close, and manage independently
- **New file**: Create a blank untitled tab from the header or with `Ctrl+N`; save to disk later
- **Open file**: Open `.md` / `.txt` files via dialog (`Ctrl+O`) or the folder view
- **Save / Save As**: Save the active file (`Ctrl+S`); new files prompt for a save location. Save As (`Ctrl+Shift+S`) always prompts
- **Refresh**: Reload the active file from disk (`Ctrl+R`); preserves kanban region and scroll position
- **Preview**: Live Markdown / plain-text preview with hot reload (no file locking)
- **Mermaid**: Renders fenced `mermaid` code blocks in Markdown
- **Folder view**: Tree of `.md` / `.txt` files and subdirectories; click to open
- **Scroll**: Restores preview scroll position on hot reload
- **Kanban**: Toggle the kanban panel (`Ctrl+K`); select text → columns (headings) and cards (list items); drag to reorder; edits write back to the file. Kanban instruction modal with sample format included
- **Session**: SQLite-backed session (open tabs, active tab, folder, scroll, kanban selection, theme)
- **Import/Export**: Session data as raw `.db` files (export copy, import merge)
- **Close session**: Resets state and opens a fresh blank tab so the editor stays usable
- **Logo**: MD-Li logo in header; window/taskbar icon on Windows (multi-size `.ico`)
- **Hide editor / Hide preview**: Header checkboxes to show only editor, only preview, or both (resizable)
- **Dark and light theme**: Theme selector (Light / Dark) in header; persisted in session; editor uses matching CodeMirror theme
- **Keyboard shortcuts**: Common shortcuts for all major actions; press `F1` or click "Help" to see the full list
- **Application menu**: Custom menu bar (File, Edit, View, Help) matching all app features with keyboard shortcut labels
- **Context menus**: Right-click for context-aware native menus — editor (Undo/Redo/Cut/Copy/Paste), preview (Copy/Select All), tabs (Close Tab/Close Other Tabs/Close All Tabs), and general areas
- **About & version**: "About" modal shows app version, GitHub link, and a "Check for updates" button that queries GitHub Releases
- **Auto-update check**: Compares local version against the latest GitHub Release; offers a download button when a newer version is available

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+N` | New file |
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+R` | Refresh file from disk |
| `Ctrl+W` | Close current tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+K` | Toggle kanban panel |
| `F1` | Toggle help |

## Prerequisites

- [Node.js](https://nodejs.org/) **v18+** (v20 recommended)
- npm (comes with Node.js)
- **Windows**: No extra tools needed (native modules are rebuilt via `electron-rebuild` in `postinstall`)
- **macOS**: Xcode Command Line Tools — run `xcode-select --install`
- **Linux**: Build essentials — run `sudo apt install build-essential python3` (Debian/Ubuntu) or the equivalent for your distro

## Getting started

```bash
# 1. Clone the repo
git clone https://github.com/cyrilth/MD-Watch.git
cd MD-Watch

# 2. Install dependencies (also rebuilds native modules for Electron)
npm install

# 3. Run in development mode (hot reload)
npm run dev
```

The app window opens automatically. Edits to renderer code are hot-reloaded; edits to main/preload require restarting `npm run dev`.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the app in development mode with hot reload |
| `npm run build` | Compile main, preload, and renderer to `out/` |
| `npm start` | Preview the production build (runs `electron-vite preview`) |
| `npm run pack` | Package the app into a directory (no installer) via electron-builder |
| `npm run dist` | Package and create distributable installers for the current platform |
| `npm run release` | Build + package distributable installers (full pipeline) |

## Building distributable installers locally

After cloning and installing dependencies, you can create platform-specific installers:

### Windows

```bash
npm run build
npx electron-builder --win
```

Outputs in `dist/`:
- `MD-Watch Setup <version>.exe` (NSIS installer)
- `MD-Watch-<version>-win.zip`

### macOS

```bash
npm run build
npx electron-builder --mac
```

Outputs in `dist/`:
- `MD-Watch-<version>.dmg`
- `MD-Watch-<version>-mac.zip`

### Linux

```bash
npm run build
npx electron-builder --linux
```

Outputs in `dist/`:
- `MD-Watch-<version>.AppImage`
- `md-watch_<version>_amd64.deb`

### All platforms at once (on the current OS)

```bash
npm run release
```

> **Note**: Cross-compilation (e.g. building a Windows installer on macOS) is not supported by default. Use the GitHub Actions CI/CD workflow to build for all platforms — see below.

## Releasing a new version

1. Update the `version` field in `package.json` (e.g. `1.1.0`)
2. Commit and push
3. Create and push a tag:

```bash
git tag v1.1.0
git push origin v1.1.0
```

4. The **Build & Release** GitHub Action automatically builds for Windows, macOS, and Linux, then publishes a GitHub Release with all installers attached

## Docs

- **[Project plan](docs/Plan.md)** — Architecture, phases, tech stack, file layout
- **[Task list](docs/Task.md)** — Implementation checklist (track progress there)

## Tech (summary)

Electron, React, CodeMirror 6, chokidar (main), better-sqlite3, Mermaid, @dnd-kit, electron-builder. See [docs/Plan.md](docs/Plan.md) for details.

## License

See [LICENSE](LICENSE).
