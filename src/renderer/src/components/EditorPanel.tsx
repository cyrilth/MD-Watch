import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
type EditorPanelProps = {
  value: string
  onChange?: (value: string) => void
  filePath: string | null
  readOnly?: boolean
}

/** Editor panel: CodeMirror 6; displays current file content; accepts updates from file-changed via value prop. */
export function EditorPanel({ value, onChange, filePath, readOnly = false }: EditorPanelProps) {
  return (
    <div className="panel editor-panel" data-testid="editor-panel">
      <CodeMirror
        key={filePath ?? 'empty'}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        height="100%"
        className="editor-codemirror"
        extensions={[markdown()]}
        basicSetup={true}
      />
    </div>
  )
}
