# MD-Watch

A desktop app to preview Markdown and plain text with hot reload, Mermaid diagrams, a folder view, and a bidirectional kanban board driven by selected text. Built with Electron to learn the stack.

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

## Docs

- **[Project plan](docs/Plan.md)** — Architecture, phases, tech stack, file layout
- **[Task list](docs/Task.md)** — Implementation checklist (track progress there)

## Tech (summary)

Electron, React, CodeMirror 6, chokidar (main), better-sqlite3, Mermaid, @dnd-kit. See [docs/Plan.md](docs/Plan.md) for details.

## License

See [LICENSE](LICENSE).
