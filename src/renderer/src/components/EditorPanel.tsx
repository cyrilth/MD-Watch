import type { ViewUpdate } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'

export type KanbanRegion = { start: number; end: number }

type EditorPanelProps = {
  value: string
  onChange?: (value: string) => void
  filePath: string | null
  readOnly?: boolean
  /** Called when selection changes (2.1); reports { start, end } for the main selection. */
  onSelectionChange?: (range: KanbanRegion) => void
}

/** Editor panel: CodeMirror 6; displays current file content; accepts updates from file-changed via value prop. */
export function EditorPanel({
  value,
  onChange,
  filePath,
  readOnly = false,
  onSelectionChange,
}: EditorPanelProps) {
  const handleUpdate = (vu: ViewUpdate) => {
    if (!onSelectionChange) return
    const main = vu.state.selection.main
    onSelectionChange({ start: main.from, end: main.to })
  }

  return (
    <div className="panel editor-panel" data-testid="editor-panel">
      <CodeMirror
        key={filePath ?? 'empty'}
        value={value}
        onChange={onChange}
        onUpdate={handleUpdate}
        readOnly={readOnly}
        height="100%"
        className="editor-codemirror"
        extensions={[markdown()]}
        basicSetup={true}
      />
    </div>
  )
}
