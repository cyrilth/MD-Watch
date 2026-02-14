import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { forwardRef } from 'react'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Markdown pipeline: detect fenced code blocks with language `mermaid` and render as div.mermaid (1.18)
marked.use({
  renderer: {
    code({ lang, text }: { lang?: string; text: string }) {
      if (lang === 'mermaid') {
        return `<div class="mermaid">${escapeHtml(text)}</div>\n`
      }
      const escaped = escapeHtml(text)
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      return `<pre><code${langAttr}>${escaped}</code></pre>\n`
    },
  },
})

type PreviewPanelProps = {
  content: string
  isMarkdown: boolean
  /** Called when user scrolls (for session persist). */
  onScroll?: () => void
}

/** Preview panel: .md → Markdown to HTML (marked); .txt → plain text (pre-wrap) in scrollable container. */
export const PreviewPanel = forwardRef<HTMLDivElement, PreviewPanelProps>(function PreviewPanel(
  { content, isMarkdown, onScroll },
  ref
) {
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
        <div ref={ref} className="preview-content preview-plaintext" onScroll={onScroll}>
          {content}
        </div>
      </div>
    )
  }

  const rawHtml = marked(content, { gfm: true, async: false })
  const sanitizedHtml = DOMPurify.sanitize(rawHtml)

  return (
    <div className="panel preview-panel" data-testid="preview-panel">
      <div
        ref={ref}
        className="preview-content preview-markdown"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        onScroll={onScroll}
      />
    </div>
  )
})
