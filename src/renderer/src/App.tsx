import { useCallback, useEffect, useState } from 'react'
import { EditorPanel } from '@/components/EditorPanel'
import { PreviewPanel } from '@/components/PreviewPanel'
import { ResizableSplit } from '@/components/ResizableSplit'

function App() {
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [currentContent, setCurrentContent] = useState('')

  // Sync: on file load — set content so editor and preview update
  const handleOpenFile = useCallback(async () => {
    const result = await window.electron.openFile()
    if (!result) return
    setCurrentFilePath(result.path)
    setCurrentContent(result.content)
    await window.electron.watchFile(result.path)
  }, [])

  // Sync: on file-changed — update content so editor and preview stay in sync
  useEffect(() => {
    const unsubscribe = window.electron.onFileChanged((_path, content) => {
      setCurrentContent(content)
    })
    return unsubscribe
  }, [])

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
