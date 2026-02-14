import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { EditorPanel, type KanbanRegion } from '@/components/EditorPanel'
import logoUrl from '@/assets/md-watch-logo.png'
import { FolderView } from '@/components/FolderView'
import { PreviewPanel } from '@/components/PreviewPanel'
import { ResizableSplit } from '@/components/ResizableSplit'
import { kanbanToMarkdown, parseKanbanSelection } from '@/kanban/parser'
import { SAMPLE_KANBAN_MARKDOWN } from '@/kanban/sample'
import { KanbanBoard } from '@/components/KanbanBoard'

mermaid.initialize({ startOnLoad: false })

// ---------------------------------------------------------------------------
// Tab types and helpers
// ---------------------------------------------------------------------------

type Tab = {
  id: string
  filePath: string | null
  content: string
  kanbanRegion: KanbanRegion | null
}

let nextTabId = 1
function createTabId(): string {
  return `tab-${nextTabId++}`
}

function basename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || filePath
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [folderRootPath, setFolderRootPath] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [hideEditor, setHideEditor] = useState(false)
  const [hidePreview, setHidePreview] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const savedScrollRatioRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showKanbanInstructionModal, setShowKanbanInstructionModal] = useState(false)
  const [showKanban, setShowKanban] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // ---------------------------------------------------------------------------
  // Derived active tab
  // ---------------------------------------------------------------------------

  const activeTab: Tab | null = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  )

  const currentFilePath = activeTab?.filePath ?? null
  const currentContent = activeTab?.content ?? ''
  const kanbanRegion = activeTab?.kanbanRegion ?? null

  // ---------------------------------------------------------------------------
  // Tab mutators
  // ---------------------------------------------------------------------------

  /** Update a field on a specific tab by id. */
  const updateTab = useCallback((tabId: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...patch } : t)))
  }, [])

  /** Update the active tab's content. */
  const setCurrentContent = useCallback(
    (content: string) => {
      if (!activeTabId) return
      updateTab(activeTabId, { content })
    },
    [activeTabId, updateTab]
  )

  /** Update the active tab's kanban region. */
  const setKanbanRegion = useCallback(
    (region: KanbanRegion | null) => {
      if (!activeTabId) return
      updateTab(activeTabId, { kanbanRegion: region })
    },
    [activeTabId, updateTab]
  )

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast({ message, type })
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null)
      toastTimeoutRef.current = null
    }, 3000)
  }, [])

  // ---------------------------------------------------------------------------
  // Kanban state (derived)
  // ---------------------------------------------------------------------------

  const kanbanState = useMemo(() => {
    if (!kanbanRegion || kanbanRegion.start === kanbanRegion.end) return null
    const len = currentContent.length
    if (kanbanRegion.start > len || kanbanRegion.end > len || kanbanRegion.start < 0) {
      return null
    }
    return parseKanbanSelection(currentContent, kanbanRegion)
  }, [currentContent, kanbanRegion])

  // When range becomes invalid, clear selection
  useEffect(() => {
    if (!kanbanRegion || !activeTabId) return
    const len = currentContent.length
    if (kanbanRegion.start > len || kanbanRegion.end > len || kanbanRegion.start < 0) {
      setKanbanRegion(null)
    }
  }, [currentContent, kanbanRegion, activeTabId, setKanbanRegion])

  // ---------------------------------------------------------------------------
  // Kanban change handler
  // ---------------------------------------------------------------------------

  const handleKanbanChange = useCallback(
    (next: { columns: { id: string; title: string; cards: { id: string; text: string }[] }[] }) => {
      if (!kanbanRegion || !activeTabId) return
      const newMarkdown = kanbanToMarkdown(next)
      const newContent =
        currentContent.slice(0, kanbanRegion.start) +
        newMarkdown +
        currentContent.slice(kanbanRegion.end)
      updateTab(activeTabId, {
        content: newContent,
        kanbanRegion: { start: kanbanRegion.start, end: kanbanRegion.start + newMarkdown.length },
      })
      if (currentFilePath) {
        window.electron.writeFile(currentFilePath, newContent).catch(() => {})
      }
    },
    [currentContent, kanbanRegion, currentFilePath, activeTabId, updateTab]
  )

  // ---------------------------------------------------------------------------
  // New file – create a blank untitled tab
  // ---------------------------------------------------------------------------

  const handleNewFile = useCallback(() => {
    const id = createTabId()
    const newTab: Tab = { id, filePath: null, content: '', kanbanRegion: null }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(id)
    window.electron.unwatchFile()
  }, [])

  // ---------------------------------------------------------------------------
  // Open file in a tab (reuse existing tab for same path)
  // ---------------------------------------------------------------------------

  const openFileInTab = useCallback(
    async (path: string) => {
      shouldRestoreScrollRef.current = false
      // If already open in a tab, just switch to it
      const existing = tabs.find((t) => t.filePath === path)
      if (existing) {
        setActiveTabId(existing.id)
        await window.electron.watchFile(path)
        return
      }
      // Create new tab
      try {
        const content = await window.electron.readFile(path)
        const id = createTabId()
        const newTab: Tab = { id, filePath: path, content, kanbanRegion: null }
        setTabs((prev) => [...prev, newTab])
        setActiveTabId(id)
        await window.electron.watchFile(path)
      } catch {
        // ignore
      }
    },
    [tabs]
  )

  const openFileInTabRef = useRef(openFileInTab)
  openFileInTabRef.current = openFileInTab

  // ---------------------------------------------------------------------------
  // Switch tab: watch new active file
  // ---------------------------------------------------------------------------

  const switchTab = useCallback(
    async (tabId: string) => {
      setActiveTabId(tabId)
      const tab = tabs.find((t) => t.id === tabId)
      if (tab?.filePath) {
        await window.electron.watchFile(tab.filePath)
      } else {
        await window.electron.unwatchFile()
      }
    },
    [tabs]
  )

  // ---------------------------------------------------------------------------
  // Close tab
  // ---------------------------------------------------------------------------

  const closeTab = useCallback(
    async (tabId: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId)
        if (idx === -1) return prev
        const next = prev.filter((t) => t.id !== tabId)
        // If closing the active tab, switch to an adjacent one
        if (tabId === activeTabId) {
          if (next.length === 0) {
            setActiveTabId(null)
            window.electron.unwatchFile()
          } else {
            const newIdx = Math.min(idx, next.length - 1)
            const newActive = next[newIdx]
            setActiveTabId(newActive.id)
            if (newActive.filePath) {
              window.electron.watchFile(newActive.filePath)
            } else {
              window.electron.unwatchFile()
            }
          }
        }
        return next
      })
    },
    [activeTabId]
  )

  // ---------------------------------------------------------------------------
  // Session restore / apply
  // ---------------------------------------------------------------------------

  const applySession = useCallback(async (session: Record<string, unknown>) => {
    if (typeof session?.lastOpenedFolder === 'string' && session.lastOpenedFolder.trim()) {
      setFolderRootPath(session.lastOpenedFolder)
    }
    if (session?.theme === 'dark' || session?.theme === 'light') {
      setTheme(session.theme)
    }

    // Restore tabs
    const savedTabs = session?.openTabs
    if (Array.isArray(savedTabs) && savedTabs.length > 0) {
      const restoredTabs: Tab[] = []
      for (const entry of savedTabs) {
        if (typeof entry?.filePath !== 'string' || !entry.filePath.trim()) continue
        try {
          const content = await window.electron.readFile(entry.filePath)
          const id = createTabId()
          let kr: KanbanRegion | null = null
          if (
            entry.kanbanRegion &&
            typeof entry.kanbanRegion === 'object' &&
            typeof entry.kanbanRegion.start === 'number' &&
            typeof entry.kanbanRegion.end === 'number'
          ) {
            kr = { start: entry.kanbanRegion.start, end: entry.kanbanRegion.end }
          }
          restoredTabs.push({ id, filePath: entry.filePath, content, kanbanRegion: kr })
        } catch {
          // skip unreadable files
        }
      }
      if (restoredTabs.length > 0) {
        setTabs(restoredTabs)
        // Restore active tab by saved activeTabIndex or default to first
        let activeIdx = 0
        if (typeof session?.activeTabIndex === 'number' && session.activeTabIndex < restoredTabs.length) {
          activeIdx = session.activeTabIndex
        }
        setActiveTabId(restoredTabs[activeIdx].id)
        const activeFile = restoredTabs[activeIdx].filePath
        if (activeFile) {
          await window.electron.watchFile(activeFile)
        }
      }
    } else if (typeof session?.lastFilePath === 'string' && session.lastFilePath.trim()) {
      // Backwards compat: single file session
      await openFileInTabRef.current(session.lastFilePath).catch(() => {})
    } else {
      // No saved tabs — start with a blank untitled tab so the editor is usable
      const id = createTabId()
      setTabs([{ id, filePath: null, content: '', kanbanRegion: null }])
      setActiveTabId(id)
    }

    if (typeof session?.previewScrollRatio === 'number') {
      savedScrollRatioRef.current = session.previewScrollRatio
      shouldRestoreScrollRef.current = true
    }
  }, [])

  useEffect(() => {
    window.electron.getSession().then(applySession)
  }, [applySession])

  useEffect(() => {
    const unsubscribe = window.electron.onSessionImported(() => {
      window.electron.getSession().then(applySession)
    })
    return unsubscribe
  }, [applySession])

  // ---------------------------------------------------------------------------
  // Persist tabs to session
  // ---------------------------------------------------------------------------

  const sessionPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (sessionPersistRef.current) clearTimeout(sessionPersistRef.current)
    sessionPersistRef.current = setTimeout(() => {
      sessionPersistRef.current = null
      const openTabs = tabs
        .filter((t) => t.filePath)
        .map((t) => ({ filePath: t.filePath, kanbanRegion: t.kanbanRegion }))
      const activeIdx = tabs.findIndex((t) => t.id === activeTabId)
      window.electron.setSession({
        openTabs,
        activeTabIndex: activeIdx >= 0 ? activeIdx : 0,
        lastFilePath: currentFilePath,
      })
    }, 500)
    return () => {
      if (sessionPersistRef.current) clearTimeout(sessionPersistRef.current)
    }
  }, [tabs, activeTabId, currentFilePath])

  // ---------------------------------------------------------------------------
  // Open file (dialog)
  // ---------------------------------------------------------------------------

  const handleOpenFile = useCallback(async () => {
    const result = await window.electron.openFile()
    if (!result) return
    shouldRestoreScrollRef.current = false
    await openFileInTabRef.current(result.path)
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

  const handleCloseSession = useCallback(async () => {
    await window.electron.unwatchFile()
    // Create a fresh blank tab so the editor stays usable
    const id = createTabId()
    const blankTab: Tab = { id, filePath: null, content: '', kanbanRegion: null }
    setTabs([blankTab])
    setActiveTabId(id)
    setFolderRootPath(null)
    await window.electron.setSession({
      openTabs: null,
      activeTabIndex: null,
      lastFilePath: null,
      lastOpenedFolder: null,
      previewScrollRatio: null,
      kanbanSelection: null,
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Preview scroll persist
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // File watcher: update active tab content on external change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = window.electron.onFileChanged((changedPath, content) => {
      // Update the tab that matches the changed path (should be the active one)
      setTabs((prev) =>
        prev.map((t) => (t.filePath === changedPath ? { ...t, content } : t))
      )
      const el = previewContainerRef.current
      if (el) {
        const { scrollTop, scrollHeight, clientHeight } = el
        const maxScroll = scrollHeight - clientHeight
        savedScrollRatioRef.current = maxScroll > 0 ? scrollTop / maxScroll : 0
      }
      shouldRestoreScrollRef.current = true
    })
    return unsubscribe
  }, [])

  // Restore scroll after hot reload
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

  // Mermaid
  const isMarkdown = currentFilePath?.toLowerCase().endsWith('.md')
  useEffect(() => {
    if (!isMarkdown) return
    const container = previewContainerRef.current
    if (!container) return
    const nodes = container.querySelectorAll<HTMLElement>('.mermaid')
    if (nodes.length === 0) return
    mermaid.run({ nodes, suppressErrors: true }).catch(() => {})
  }, [currentContent, isMarkdown])

  // ---------------------------------------------------------------------------
  // Save / Save As
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!activeTabId) return
    if (currentFilePath) {
      // File exists on disk: write current content
      await window.electron.writeFile(currentFilePath, currentContent)
      showToast('Saved.', 'success')
    } else {
      // New file: prompt Save As
      const result = await window.electron.saveFileAs(currentContent)
      if (result) {
        updateTab(activeTabId, { filePath: result.path })
        await window.electron.watchFile(result.path)
        showToast('Saved.', 'success')
      }
    }
  }, [activeTabId, currentFilePath, currentContent, updateTab, showToast])

  const handleSaveAs = useCallback(async () => {
    if (!activeTabId) return
    const defaultName = currentFilePath ? basename(currentFilePath) : undefined
    const result = await window.electron.saveFileAs(currentContent, defaultName)
    if (result) {
      updateTab(activeTabId, { filePath: result.path })
      await window.electron.watchFile(result.path)
      showToast('Saved.', 'success')
    }
  }, [activeTabId, currentFilePath, currentContent, updateTab, showToast])

  const handleRefreshFile = useCallback(async () => {
    if (!activeTabId || !currentFilePath) return
    try {
      // Save scroll position before reload
      const el = previewContainerRef.current
      if (el) {
        const { scrollTop, scrollHeight, clientHeight } = el
        const maxScroll = scrollHeight - clientHeight
        savedScrollRatioRef.current = maxScroll > 0 ? scrollTop / maxScroll : 0
      }
      shouldRestoreScrollRef.current = true

      const content = await window.electron.readFile(currentFilePath)
      // Keep kanban region if still valid, otherwise clear it
      const kr = kanbanRegion
      if (kr && (kr.start > content.length || kr.end > content.length)) {
        updateTab(activeTabId, { content, kanbanRegion: null })
      } else {
        updateTab(activeTabId, { content })
      }
      showToast('File reloaded.', 'success')
    } catch {
      showToast('Failed to reload file.', 'error')
    }
  }, [activeTabId, currentFilePath, kanbanRegion, updateTab, showToast])

  const handleThemeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'light' | 'dark'
    setTheme(value)
    window.electron.setSession({ theme: value })
  }, [])

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      // Ctrl+S / Ctrl+Shift+S — Save / Save As
      if (mod && e.key === 's') {
        e.preventDefault()
        if (e.shiftKey) handleSaveAs()
        else handleSave()
        return
      }
      // Ctrl+N — New file
      if (mod && e.key === 'n') {
        e.preventDefault()
        handleNewFile()
        return
      }
      // Ctrl+O — Open file
      if (mod && e.key === 'o' && !e.shiftKey) {
        e.preventDefault()
        handleOpenFile()
        return
      }
      // Ctrl+R — Refresh
      if (mod && e.key === 'r') {
        e.preventDefault()
        handleRefreshFile()
        return
      }
      // Ctrl+W — Close tab
      if (mod && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) closeTab(activeTabId)
        return
      }
      // Ctrl+K — Toggle kanban
      if (mod && e.key === 'k') {
        e.preventDefault()
        setShowKanban((v) => !v)
        return
      }
      // Ctrl+Tab — Next tab
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        if (tabs.length > 1 && activeTabId) {
          const idx = tabs.findIndex((t) => t.id === activeTabId)
          const nextIdx = e.shiftKey
            ? (idx - 1 + tabs.length) % tabs.length
            : (idx + 1) % tabs.length
          switchTab(tabs[nextIdx].id)
        }
        return
      }
      // F1 — Help
      if (e.key === 'F1') {
        e.preventDefault()
        setShowHelp((v) => !v)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, handleSaveAs, handleNewFile, handleOpenFile, handleRefreshFile, activeTabId, closeTab, tabs, switchTab])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="app" data-theme={theme}>
      <header className="app-header">
        <img src={logoUrl} alt="MD-Li" className="app-logo" />
        <button type="button" onClick={handleNewFile}>
          New file
        </button>
        <button type="button" onClick={handleOpenFile}>
          Open file
        </button>
        <button type="button" onClick={handleRefreshFile}>
          Refresh
        </button>
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={handleSaveAs}>
          Save as
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
        <button type="button" onClick={handleCloseSession}>
          Close session
        </button>
        <label className="app-header-toggle">
          <input
            type="checkbox"
            checked={hideEditor}
            onChange={(e) => setHideEditor(e.target.checked)}
          />
          Hide editor
        </label>
        <label className="app-header-toggle">
          <input
            type="checkbox"
            checked={hidePreview}
            onChange={(e) => setHidePreview(e.target.checked)}
          />
          Hide preview
        </label>
        <button
          type="button"
          className={showKanban ? 'app-header-btn-active' : ''}
          onClick={() => setShowKanban((v) => !v)}
        >
          Kanban
        </button>
        <select
          className="app-header-theme"
          value={theme}
          onChange={handleThemeChange}
          aria-label="Theme"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <button type="button" onClick={() => setShowHelp(true)}>
          Help
        </button>
      </header>

      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="tab-bar">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'tab-active' : ''}`}
              onClick={() => switchTab(tab.id)}
              title={tab.filePath ?? 'Untitled'}
            >
              <span className="tab-label">
                {tab.filePath ? basename(tab.filePath) : 'Untitled'}
              </span>
              <button
                type="button"
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                aria-label="Close tab"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="app-body">
        <aside className="app-sidebar">
          <FolderView rootPath={folderRootPath} onOpenFile={openFileInTab} />
        </aside>
        <div className="app-main">
          {hideEditor && hidePreview ? (
            <div className="app-main-placeholder">Editor and preview are hidden.</div>
          ) : hideEditor ? (
            <div className="app-main-single">
              <PreviewPanel
                ref={previewContainerRef}
                content={currentContent}
                isMarkdown={currentFilePath ? currentFilePath.toLowerCase().endsWith('.md') : true}
                onScroll={handlePreviewScroll}
              />
            </div>
          ) : hidePreview ? (
            <div className="app-main-single">
              <EditorPanel
                value={currentContent}
                onChange={setCurrentContent}
                filePath={currentFilePath}
                onSelectionChange={setKanbanRegion}
                theme={theme}
              />
            </div>
          ) : (
            <ResizableSplit
              left={
                <EditorPanel
                  value={currentContent}
                  onChange={setCurrentContent}
                  filePath={currentFilePath}
                  onSelectionChange={setKanbanRegion}
                  theme={theme}
                />
              }
              right={
                <PreviewPanel
                  ref={previewContainerRef}
                  content={currentContent}
                  isMarkdown={currentFilePath ? currentFilePath.toLowerCase().endsWith('.md') : true}
                  onScroll={handlePreviewScroll}
                />
              }
              defaultLeftPercent={50}
            />
          )}
          {showKanban && (
            kanbanState ? (
              <section className="kanban-section" aria-label="Kanban board">
                <KanbanBoard state={kanbanState} onKanbanChange={handleKanbanChange} />
              </section>
            ) : (
              <section className="kanban-section kanban-instructions" aria-label="Kanban instructions">
                <div className="kanban-instructions-content">
                  <p className="kanban-instructions-title">Kanban board</p>
                  <p className="kanban-instructions-text">
                    Select markdown in the editor where headings are columns and list items are cards. Drag cards between columns to reorder; changes write back to the file.
                  </p>
                  <button
                    type="button"
                    className="kanban-instructions-load"
                    onClick={() => setShowKanbanInstructionModal(true)}
                  >
                    Kanban instruction
                  </button>
                </div>
              </section>
            )
          )}
          {showKanbanInstructionModal && (
            <div
              className="kanban-modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="kanban-modal-title"
              onClick={() => setShowKanbanInstructionModal(false)}
            >
              <div
                className="kanban-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="kanban-modal-title" className="kanban-modal-title">How to use Kanban</h2>
                <p className="kanban-modal-p">
                  In the editor, select markdown where <strong>headings</strong> (<code>#</code>, <code>##</code>, etc.) are columns and <strong>list items</strong> (<code>-</code> or <code>*</code> followed by a space) are cards. The board appears below when the selection is valid. Drag cards between columns to reorder; edits are written back to the file.
                </p>
                <p className="kanban-modal-p">
                  Use the sample format below: select and copy it, then paste into your document and select the pasted block to try the kanban board.
                </p>
                <div className="kanban-modal-sample-wrap">
                  <pre className="kanban-modal-sample"><code>{SAMPLE_KANBAN_MARKDOWN}</code></pre>
                </div>
                <button
                  type="button"
                  className="kanban-modal-close"
                  onClick={() => setShowKanbanInstructionModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showHelp && (
        <div
          className="kanban-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          onClick={() => setShowHelp(false)}
        >
          <div className="kanban-modal help-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="help-modal-title" className="kanban-modal-title">Keyboard shortcuts</h2>
            <table className="help-shortcut-table">
              <thead>
                <tr><th>Shortcut</th><th>Action</th></tr>
              </thead>
              <tbody>
                <tr><td><kbd>Ctrl+N</kbd></td><td>New file</td></tr>
                <tr><td><kbd>Ctrl+O</kbd></td><td>Open file</td></tr>
                <tr><td><kbd>Ctrl+S</kbd></td><td>Save</td></tr>
                <tr><td><kbd>Ctrl+Shift+S</kbd></td><td>Save as</td></tr>
                <tr><td><kbd>Ctrl+R</kbd></td><td>Refresh file from disk</td></tr>
                <tr><td><kbd>Ctrl+W</kbd></td><td>Close current tab</td></tr>
                <tr><td><kbd>Ctrl+Tab</kbd></td><td>Next tab</td></tr>
                <tr><td><kbd>Ctrl+Shift+Tab</kbd></td><td>Previous tab</td></tr>
                <tr><td><kbd>Ctrl+K</kbd></td><td>Toggle kanban panel</td></tr>
                <tr><td><kbd>F1</kbd></td><td>Toggle this help</td></tr>
              </tbody>
            </table>
            <button
              type="button"
              className="kanban-modal-close"
              onClick={() => setShowHelp(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className={`app-toast app-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
