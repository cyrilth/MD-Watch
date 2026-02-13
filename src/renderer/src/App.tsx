import { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { EditorPanel } from '@/components/EditorPanel'
import { PreviewPanel } from '@/components/PreviewPanel'
import { ResizableSplit } from '@/components/ResizableSplit'

mermaid.initialize({ startOnLoad: false })

function App() {
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [currentContent, setCurrentContent] = useState('')
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const savedScrollRatioRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef(false)

  // Sync: on file load — set content so editor and preview update (no scroll restore)
  const handleOpenFile = useCallback(async () => {
    const result = await window.electron.openFile()
    if (!result) return
    shouldRestoreScrollRef.current = false
    setCurrentFilePath(result.path)
    setCurrentContent(result.content)
    await window.electron.watchFile(result.path)
  }, [])

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
        {currentFilePath && (
          <span className="app-header-path" title={currentFilePath}>
            {currentFilePath}
          </span>
        )}
      </header>
      <ResizableSplit
        left={
          <EditorPanel
            value={currentContent}
            onChange={setCurrentContent}
            filePath={currentFilePath}
          />
        }
        right={
          <PreviewPanel
            ref={previewContainerRef}
            content={currentContent}
            isMarkdown={currentFilePath?.toLowerCase().endsWith('.md') ?? false}
          />
        }
        defaultLeftPercent={50}
      />
    </div>
  )
}

export default App
