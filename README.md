# MD-Watch

A desktop app to preview Markdown and plain text with hot reload, Mermaid diagrams, a folder view, and a bidirectional kanban board driven by selected text. Built with Electron to learn the stack.

## Features

- **Preview**: Local `.md` and `.txt` with hot reload (no file locking)
- **Mermaid**: Renders fenced `mermaid` code blocks in Markdown
- **Folder view**: Tree of .md/.txt files and subdirectories; click to open
- **Scroll**: Restores preview scroll position on hot reload
- **Kanban**: Select text → columns (headings) and cards (list items); drag to reorder; edits write back to the file
- **Session**: SQLite-backed session (last file, folder, scroll, kanban selection, theme)
- **Import/Export**: Session data as raw `.db` files (export copy, import merge)
- **Logo**: MD-Li logo in header; window/taskbar icon on Windows (multi-size .ico)
- **Hide editor / Hide preview**: Header checkboxes to show only editor, only preview, or both (resizable)
- **Dark and light theme**: Theme selector (Light / Dark) in header; persisted in session; editor uses matching CodeMirror theme

## Docs

- **[Project plan](docs/Plan.md)** — Architecture, phases, tech stack, file layout
- **[Task list](docs/Task.md)** — Implementation checklist (track progress there)

## Tech (summary)

Electron, React, CodeMirror 6, chokidar (main), better-sqlite3, Mermaid, @dnd-kit. See [docs/Plan.md](docs/Plan.md) for details.

## License

See [LICENSE](LICENSE).
