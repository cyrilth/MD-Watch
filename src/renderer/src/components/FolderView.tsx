import { useCallback, useEffect, useRef, useState } from 'react'

export type FolderEntry = {
  name: string
  path: string
  isDirectory: boolean
}

type FolderViewProps = {
  rootPath: string | null
  onOpenFile?: (filePath: string) => void
}

type FolderTreeProps = {
  entries: FolderEntry[]
  depth: number
  expandedPaths: Set<string>
  directoryContents: Record<string, FolderEntry[]>
  loadingPaths: Set<string>
  onToggleDir: (path: string) => void
  onOpenFile?: (filePath: string) => void
}

function FolderTree({
  entries,
  depth,
  expandedPaths,
  directoryContents,
  loadingPaths,
  onToggleDir,
  onOpenFile,
}: FolderTreeProps) {
  return (
    <ul className="folder-view-tree" style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
      {entries.map((entry) => (
        <li
          key={entry.path}
          className={`folder-view-entry folder-view-entry-${entry.isDirectory ? 'dir' : 'file'}`}
        >
          {entry.isDirectory ? (
            <>
              <button
                type="button"
                className="folder-view-entry-btn folder-view-entry-btn-dir"
                onClick={() => onToggleDir(entry.path)}
                title={entry.path}
              >
                <span className="folder-view-entry-chevron" aria-hidden>
                  {expandedPaths.has(entry.path) ? '▼' : '▶'}
                </span>
                <span className="folder-view-entry-icon">📁</span>
                <span className="folder-view-entry-name">{entry.name}</span>
              </button>
              {expandedPaths.has(entry.path) && (
                <>
                  {loadingPaths.has(entry.path) ? (
                    <div className="folder-view-loading folder-view-loading-nested">Loading…</div>
                  ) : directoryContents[entry.path] ? (
                    <FolderTree
                      entries={directoryContents[entry.path]}
                      depth={depth + 1}
                      expandedPaths={expandedPaths}
                      directoryContents={directoryContents}
                      loadingPaths={loadingPaths}
                      onToggleDir={onToggleDir}
                      onOpenFile={onOpenFile}
                    />
                  ) : null}
                </>
              )}
            </>
          ) : (
            <button
              type="button"
              className="folder-view-entry-btn"
              onClick={() => onOpenFile?.(entry.path)}
              title={entry.path}
            >
              <span className="folder-view-entry-icon">📄</span>
              <span className="folder-view-entry-name">{entry.name}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Tree UI for opened folder: root = opened folder, expandable dirs, .md/.txt and subdirs per directory (1.23, 1.24). */
export function FolderView({ rootPath, onOpenFile }: FolderViewProps) {
  const [entries, setEntries] = useState<FolderEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [directoryContents, setDirectoryContents] = useState<Record<string, FolderEntry[]>>({})
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set())
  const directoryContentsRef = useRef<Record<string, FolderEntry[]>>({})
  useEffect(() => {
    directoryContentsRef.current = directoryContents
  }, [directoryContents])

  useEffect(() => {
    if (!rootPath) {
      setEntries([])
      setExpandedPaths(new Set())
      setDirectoryContents({})
      setLoadingPaths(new Set())
      return
    }
    setLoading(true)
    window.electron
      .listDirectory(rootPath)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [rootPath])

  const toggleDirectory = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    if (directoryContentsRef.current[path]) return
    setLoadingPaths((p) => new Set(p).add(path))
    window.electron
      .listDirectory(path)
      .then((data) => setDirectoryContents((p) => ({ ...p, [path]: data })))
      .catch(() => {})
      .finally(() => setLoadingPaths((p) => new Set([...p].filter((x) => x !== path))))
  }, [])

  if (!rootPath) {
    return (
      <div className="folder-view folder-view-empty">
        <p className="folder-view-placeholder">Open a folder to browse</p>
      </div>
    )
  }

  const rootName = rootPath.split(/[/\\]/).filter(Boolean).pop() ?? rootPath

  return (
    <div className="folder-view" data-testid="folder-view">
      <div className="folder-view-root" title={rootPath}>
        <span className="folder-view-root-icon">📁</span>
        <span className="folder-view-root-label">{rootName}</span>
      </div>
      {loading ? (
        <div className="folder-view-loading">Loading…</div>
      ) : (
        <FolderTree
          entries={entries}
          depth={0}
          expandedPaths={expandedPaths}
          directoryContents={directoryContents}
          loadingPaths={loadingPaths}
          onToggleDir={toggleDirectory}
          onOpenFile={onOpenFile}
        />
      )}
    </div>
  )
}
