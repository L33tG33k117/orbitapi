'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileSpreadsheet, FileText, FileType, FileJson, Table, Sheet, Check } from 'lucide-react'
import { toTable, exportAs, type ExportFormat } from '@/lib/export-data'

const OPTIONS: { format: ExportFormat; label: string; hint: string; icon: typeof Download }[] = [
  { format: 'excel', label: 'Excel', hint: 'Opens in Excel / Numbers', icon: FileSpreadsheet },
  { format: 'csv', label: 'CSV', hint: 'Spreadsheets, Google Sheets', icon: Table },
  { format: 'pdf', label: 'PDF', hint: 'Print-ready document', icon: FileType },
  { format: 'word', label: 'Word', hint: 'Opens in Word / Docs', icon: FileText },
  { format: 'text', label: 'Plain text', hint: 'A simple .txt table', icon: Sheet },
  { format: 'json', label: 'JSON', hint: 'Raw data for developers', icon: FileJson },
]

/**
 * Export any API response. `data` is the raw response (envelope or not) — the
 * exporter finds the records itself. Drop this anywhere a result is shown.
 */
export function ResultExport({
  data,
  baseName,
  variant = 'button',
  className = '',
}: {
  data: unknown
  baseName: string
  variant?: 'button' | 'ghost' | 'compact'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<ExportFormat | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const table = toTable(data)
  const count = table.isCollection ? table.rows.length : 1

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('resize', () => setOpen(false), { once: true })
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      // Right-align the 224px menu under the trigger, clamped to the viewport.
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 224, window.innerWidth - 232)) })
    }
    setOpen(o => !o)
  }

  function pick(format: ExportFormat) {
    exportAs(format, data, baseName)
    setDone(format)
    setOpen(false)
    setTimeout(() => setDone(null), 1500)
  }

  const base =
    variant === 'compact'
      ? 'inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground transition-colors'
      : variant === 'ghost'
      ? 'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
      : 'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted transition-colors'

  return (
    <>
      <button ref={btnRef} onClick={toggle} className={`${base} ${className}`} title="Export these results">
        {done ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Download className="h-3.5 w-3.5" />}
        {variant === 'compact' ? (done ? 'Saved' : 'Export') : done ? 'Exported' : 'Export'}
      </button>

      {open && pos && createPortal(
        <div
          className="fixed z-[200] w-56 rounded-xl border bg-popover shadow-xl p-1.5"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={e => e.stopPropagation()}
        >
          <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
            Export <span className="font-medium text-foreground">{count.toLocaleString()}</span>{' '}
            {table.isCollection ? `row${count !== 1 ? 's' : ''}` : 'result'} as:
          </p>
          {OPTIONS.map(o => {
            const Icon = o.icon
            return (
              <button
                key={o.format}
                onClick={() => pick(o.format)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-muted transition-colors"
              >
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium leading-tight">{o.label}</span>
                  <span className="block text-[11px] text-muted-foreground leading-tight">{o.hint}</span>
                </span>
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
