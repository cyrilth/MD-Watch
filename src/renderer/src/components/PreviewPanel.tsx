import DOMPurify from 'dompurify'
import { marked } from 'marked'

type PreviewPanelProps = {
  content: string
  isMarkdown: boolean
}

/** Preview panel: .md → Markdown to HTML (marked); .txt → plain text (pre-wrap) in scrollable container. */
export function PreviewPanel({ content, isMarkdown }: PreviewPanelProps) {
  if (!content.trim()) {
    return (
      <div className="panel preview-panel" data-testid="preview-panel">
        <div className="panel-placeholder">Preview</div>
      </div>
    )
  }

  if (!isMarkdown) {
    return (
      <div className="panel preview-panel" data-testid="preview-panel">
        <div className="preview-content preview-plaintext">{content}</div>
      </div>
    )
  }

  const rawHtml = marked(content, { gfm: true, async: false })
  const sanitizedHtml = DOMPurify.sanitize(rawHtml)

  return (
    <div className="panel preview-panel" data-testid="preview-panel">
      <div
        className="preview-content preview-markdown"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  )
}
