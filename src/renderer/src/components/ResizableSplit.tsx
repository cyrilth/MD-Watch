import { useCallback, useRef, useState } from 'react'

type Props = {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftPercent?: number
}

export function ResizableSplit({ left, right, defaultLeftPercent = 50 }: Props) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent)
  const isDragging = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current) return
      const percent = (e.clientX / window.innerWidth) * 100
      setLeftPercent(Math.min(95, Math.max(5, percent)))
    },
    []
  )

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseMove])

  const startDrag = useCallback(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [handleMouseMove, handleMouseUp])

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    handleMouseDown(e)
    startDrag()
  }

  return (
    <div className="resizable-split">
      <div className="resizable-split-left" style={{ width: `${leftPercent}%` }}>
        {left}
      </div>
      <div
        className="resizable-split-resizer"
        onMouseDown={handleResizerMouseDown}
        role="separator"
        aria-valuenow={leftPercent}
        aria-valuemin={5}
        aria-valuemax={95}
        aria-label="Resize panels"
      />
      <div className="resizable-split-right" style={{ width: `${100 - leftPercent}%` }}>
        {right}
      </div>
    </div>
  )
}
