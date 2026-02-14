import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { EditorPanel, type KanbanRegion } from '@/components/EditorPanel'
import { FolderView } from '@/components/FolderView'
import { PreviewPanel } from '@/components/PreviewPanel'
import { ResizableSplit } from '@/components/ResizableSplit'
import { kanbanToMarkdown, parseKanbanSelection } from '@/kanban/parser'
import { KanbanBoard } from '@/components/KanbanBoard'

mermaid.initialize({ startOnLoad: false })

function App() {
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [currentContent, setCurrentContent] = useState('')
  const [folderRootPath, setFolderRootPath] = useState<string | null>(null)
  /** Kanban region in current file: selection range { start, end } (2.1). Used by parser (2.2) and kanban UI (2.4+). */
  const [kanbanRegion, setKanbanRegion] = useState<KanbanRegion | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const savedScrollRatioRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast({ message, type })
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null)
      toastTimeoutRef.current = null
    }, 3000)
  }, [])

  // Clear kanban region when file changes (range is for previous file)
  useEffect(() => {
    setKanbanRegion(null)
  }, [currentFilePath])

  // Re-parse on content and selection change; invalid range clears kanban (2.2, 2.3, 2.8)
  const kanbanState = useMemo(() => {
    if (!kanbanRegion || kanbanRegion.start === kanbanRegion.end) return null
    const len = currentContent.length
    if (kanbanRegion.start > len || kanbanRegion.end > len || kanbanRegion.start < 0) {
      return null
    }
    return parseKanbanSelection(currentContent, kanbanRegion)
  }, [currentContent, kanbanRegion])

  // When range becomes invalid, clear selection so UI doesn’t show stale kanban (2.8)
  useEffect(() => {
    if (!kanbanRegion) return
    const len = currentContent.length
    if (kanbanRegion.start > len || kanbanRegion.end > len || kanbanRegion.start < 0) {
      setKanbanRegion(null)
    }
  }, [currentContent, kanbanRegion])

  // On card drop: replace region with new markdown, update content, write file (2.6, 2.7)
  const handleKanbanChange = useCallback(
    (next: { columns: { id: string; title: string; cards: { id: string; text: string }[] }[] }) => {
      if (!kanbanRegion || !currentFilePath) return
      const newMarkdown = kanbanToMarkdown(next)
      const newContent =
        currentContent.slice(0, kanbanRegion.start) +
        newMarkdown +
        currentContent.slice(kanbanRegion.end)
      setCurrentContent(newContent)
      window.electron.writeFile(currentFilePath, newContent).catch(() => {})
    },
    [currentContent, kanbanRegion, currentFilePath]
  )

  const openFileWithPath = useCallback(async (path: string) => {
    shouldRestoreScrollRef.current = false
    try {
      const content = await window.electron.readFile(path)
      setCurrentFilePath(path)
      setCurrentContent(content)
      await window.electron.watchFile(path)
      await window.electron.setSession({ lastFilePath: path })
    } catch {
      // ignore
    }
  }, [])

  const openFileWithPathRef = useRef(openFileWithPath)
  openFileWithPathRef.current = openFileWithPath

  const applySession = useCallback(async (session: Record<string, unknown>) => {
    if (typeof session?.lastOpenedFolder === 'string' && session.lastOpenedFolder.trim()) {
      setFolderRootPath(session.lastOpenedFolder)
    }
    if (typeof session?.lastFilePath === 'string' && session.lastFilePath.trim()) {
      await openFileWithPathRef.current(session.lastFilePath).catch(() => {})
    }
    if (typeof session?.previewScrollRatio === 'number') {
      savedScrollRatioRef.current = session.previewScrollRatio
      shouldRestoreScrollRef.current = true
    }
    const sel = session?.kanbanSelection
    if (sel && typeof sel === 'object' && typeof (sel as { start?: number }).start === 'number' && typeof (sel as { end?: number }).end === 'number') {
      setKanbanRegion({ start: (sel as { start: number }).start, end: (sel as { end: number }).end })
    }
  }, [])

  // Restore session on load (3.5)
  useEffect(() => {
    window.electron.getSession().then(applySession)
  }, [applySession])

  // On import: reload session (3.8); toast shown from handleImportSession (3.9)
  useEffect(() => {
    const unsubscribe = window.electron.onSessionImported(() => {
      window.electron.getSession().then(applySession)
    })
    return unsubscribe
  }, [applySession])

  // Sync: on file load — set content so editor and preview update (no scroll restore)
  const handleOpenFile = useCallback(async () => {
    const result = await window.electron.openFile()
    if (!result) return
    shouldRestoreScrollRef.current = false
    setCurrentFilePath(result.path)
    setCurrentContent(result.content)
    await window.electron.watchFile(result.path)
    await window.electron.setSession({ lastFilePath: result.path })
  }, [])

  const handleOpenFolder = useCallback(async () => {
    const path = await window.electron.openFolder()
    if (path) {
      setFolderRootPath(path)
      await window.electron.setSession({ lastOpenedFolder: path })
    }
  }, [])

  const handleExportSession = useCallback(async () => {
    const result = await window.electron.exportSession()
    if (result.success) showToast('Data exported.', 'success')
    else showToast(result.error ?? 'Export failed.', 'error')
  }, [showToast])

  const handleImportSession = useCallback(async () => {
    const result = await window.electron.importSession()
    if (result.success) showToast('Data imported.', 'success')
    else showToast(result.error ?? 'Import failed.', 'error')
  }, [showToast])

  // Persist preview scroll ratio on user scroll (3.6)
  const scrollPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlePreviewScroll = useCallback(() => {
    const el = previewContainerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const maxScroll = scrollHeight - clientHeight
    const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0
    if (scrollPersistTimeoutRef.current) clearTimeout(scrollPersistTimeoutRef.current)
    scrollPersistTimeoutRef.current = setTimeout(() => {
      scrollPersistTimeoutRef.current = null
      window.electron.setSession({ previewScrollRatio: ratio })
    }, 500)
  }, [])

  // Persist kanban selection when it changes (3.6)
  const kanbanPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!kanbanRegion) return
    if (kanbanPersistTimeoutRef.current) clearTimeout(kanbanPersistTimeoutRef.current)
    kanbanPersistTimeoutRef.current = setTimeout(() => {
      kanbanPersistTimeoutRef.current = null
      window.electron.setSession({ kanbanSelection: kanbanRegion })
    }, 300)
    return () => {
      if (kanbanPersistTimeoutRef.current) clearTimeout(kanbanPersistTimeoutRef.current)
    }
  }, [kanbanRegion])

  // Sync: on file-changed (hot reload) — save scroll, mark for restore, then update content
  useEffect(() => {
    const unsubscribe = window.electron.onFileChanged((_path, content) => {
      const el = previewContainerRef.current
      if (el) {
        const { scrollTop, scrollHeight, clientHeight } = el
        const maxScroll = scrollHeight - clientHeight
        savedScrollRatioRef.current = maxScroll > 0 ? scrollTop / maxScroll : 0
      }
      shouldRestoreScrollRef.current = true
      setCurrentContent(content)
    })
    return unsubscribe
  }, [])

  // Restore preview scroll only after hot reload (1.15 + 1.16), not on first load or user scroll
  useEffect(() => {
    if (!shouldRestoreScrollRef.current) return
    const el = previewContainerRef.current
    const ratio = savedScrollRatioRef.current
    if (el && ratio >= 0) {
      const restore = () => {
        const { scrollHeight, clientHeight } = el
        const maxScroll = scrollHeight - clientHeight
        if (maxScroll > 0) {
          el.scrollTop = ratio * maxScroll
        }
        shouldRestoreScrollRef.current = false
      }
      requestAnimationFrame(restore)
    } else {
      shouldRestoreScrollRef.current = false
    }
  }, [currentContent])

  // Run Mermaid on .mermaid nodes after markdown is rendered; re-runs on file change so diagrams update on hot reload (1.19 + 1.20)
  const isMarkdown = currentFilePath?.toLowerCase().endsWith('.md')
  useEffect(() => {
    if (!isMarkdown) return
    const container = previewContainerRef.current
    if (!container) return
    const nodes = container.querySelectorAll<HTMLElement>('.mermaid')
    if (nodes.length === 0) return
    mermaid.run({ nodes, suppressErrors: true }).catch(() => {})
  }, [currentContent, isMarkdown])

  return (
    <div className="app">
      <header className="app-header">
        <button type="button" onClick={handleOpenFile}>
          Open file
        </button>
        <button type="button" onClick={handleOpenFolder}>
          Open folder
        </button>
        <button type="button" onClick={handleExportSession}>
          Export data
        </button>
        <button type="button" onClick={handleImportSession}>
          Import data
        </button>
        {currentFilePath && (
          <span className="app-header-path" title={currentFilePath}>
            {currentFilePath}
          </span>
        )}
      </header>
      <div className="app-body">
        <aside className="app-sidebar">
          <FolderView rootPath={folderRootPath} onOpenFile={openFileWithPath} />
        </aside>
        <div className="app-main">
          <ResizableSplit
            left={
              <EditorPanel
                value={currentContent}
                onChange={setCurrentContent}
                filePath={currentFilePath}
                onSelectionChange={setKanbanRegion}
              />
            }
            right={
              <PreviewPanel
                ref={previewContainerRef}
                content={currentContent}
                isMarkdown={currentFilePath?.toLowerCase().endsWith('.md') ?? false}
                onScroll={handlePreviewScroll}
              />
            }
            defaultLeftPercent={50}
          />
          {kanbanState && (
            <section className="kanban-section" aria-label="Kanban board">
              <KanbanBoard state={kanbanState} onKanbanChange={handleKanbanChange} />
            </section>
          )}
        </div>
      </div>
      {toast && (
        <div className={`app-toast app-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
