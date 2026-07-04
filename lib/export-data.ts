// Universal response exporter.
//
// The vision: throw an easy GUI on any API. API responses are JSON, but the
// people OrbitAPI is for think in spreadsheets and documents. This turns an
// arbitrary API response into a clean table and serializes it to the formats a
// non-technical user actually wants — CSV, Excel, PDF, Word, plain text, JSON —
// with zero dependencies (Excel/Word via HTML that those apps open natively;
// PDF via the browser's print-to-PDF).

export type Row = Record<string, string | number | boolean | null>

// ── Finding the data ──────────────────────────────────────────────────────────

// API responses bury the useful list at different depths:
//   [ {...}, {...} ]                          → the rows
//   { tickets: [ {...} ] }                     → tickets
//   { QueryResponse: { Invoice: [ {...} ] } }  → Invoice
//   { ok: true, data: {...} }                  → unwrap the envelope first
// We unwrap common envelopes, then pick the largest array of objects anywhere in
// the tree as the "primary" collection. Falls back to a single-row key/value view.

function unwrapEnvelope(data: unknown): unknown {
  let d = data
  // OrbitAPI's /api/execute wraps as { ok, data, ... }; unwrap to the payload.
  for (let i = 0; i < 5 && d && typeof d === 'object' && !Array.isArray(d); i++) {
    const obj = d as Record<string, unknown>
    if ('data' in obj && obj.data !== null && typeof obj.data === 'object') { d = obj.data; continue }
    break
  }
  return d
}

function isObjectArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && v.every(x => x !== null && typeof x === 'object' && !Array.isArray(x))
}

function findPrimaryArray(data: unknown, depth = 0): Record<string, unknown>[] | null {
  if (depth > 6 || data === null || typeof data !== 'object') return null
  if (isObjectArray(data)) return data
  let best: Record<string, unknown>[] | null = null
  for (const v of Object.values(data as Record<string, unknown>)) {
    const found = findPrimaryArray(v, depth + 1)
    if (found && (!best || found.length > best.length)) best = found
  }
  return best
}

// Flatten nested objects into dotted keys; join primitive arrays; JSON-encode the
// rest so every cell is a scalar a spreadsheet can hold.
function flatten(obj: Record<string, unknown>, prefix = '', out: Row = {}): Row {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v === null || v === undefined) out[key] = ''
    else if (typeof v === 'object' && !Array.isArray(v)) flatten(v as Record<string, unknown>, key, out)
    else if (Array.isArray(v)) {
      out[key] = v.every(x => x === null || typeof x !== 'object') ? v.join(', ') : JSON.stringify(v)
    } else out[key] = v as string | number | boolean
  }
  return out
}

export interface TableData {
  columns: string[]
  rows: Row[]
  /** True when we found a real collection; false = single object shown as key/value. */
  isCollection: boolean
}

export function toTable(data: unknown): TableData {
  const payload = unwrapEnvelope(data)
  const primary = findPrimaryArray(payload)

  if (primary) {
    const rows = primary.map(r => flatten(r))
    const columns = [...new Set(rows.flatMap(r => Object.keys(r)))]
    return { columns, rows, isCollection: true }
  }

  // No collection: present a single object as one row (or key/value pairs).
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const flat = flatten(payload as Record<string, unknown>)
    return { columns: ['field', 'value'], rows: Object.entries(flat).map(([field, value]) => ({ field, value })), isCollection: false }
  }

  // Primitive or empty.
  return { columns: ['value'], rows: [{ value: payload == null ? '' : String(payload) }], isCollection: false }
}

// ── Serializers ───────────────────────────────────────────────────────────────

const cell = (v: unknown) => (v === null || v === undefined ? '' : String(v))

export function toCSV(t: TableData): string {
  const esc = (v: unknown) => {
    const s = cell(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = t.columns.map(esc).join(',')
  const body = t.rows.map(r => t.columns.map(c => esc(r[c])).join(',')).join('\r\n')
  return `${head}\r\n${body}`
}

export function toTSV(t: TableData): string {
  const esc = (v: unknown) => cell(v).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
  const head = t.columns.map(esc).join('\t')
  const body = t.rows.map(r => t.columns.map(c => esc(r[c])).join('\t')).join('\n')
  return `${head}\n${body}`
}

const escapeHtml = (v: unknown) =>
  cell(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function tableHtml(t: TableData): string {
  const head = `<tr>${t.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`
  const body = t.rows.map(r => `<tr>${t.columns.map(c => `<td>${escapeHtml(r[c])}</td>`).join('')}</tr>`).join('')
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`
}

// Excel opens an HTML table saved as .xls, with styling — no library needed.
export function toExcelHtml(t: TableData, title: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><style>
table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 8px;font-family:Calibri,Arial,sans-serif;font-size:11pt;mso-number-format:"\\@"}
th{background:#4f46e5;color:#fff;text-align:left}
</style></head><body>${tableHtml(t)}</body></html>`
}

// Word opens an HTML document saved as .doc, no library needed.
export function toWordHtml(t: TableData, title: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt}h1{font-size:15pt}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 8px;text-align:left;font-size:9pt}th{background:#eef}
</style></head><body><h1>${escapeHtml(title)}</h1><p>${t.rows.length} record${t.rows.length !== 1 ? 's' : ''} · exported from OrbitAPI</p>${tableHtml(t)}</body></html>`
}

// Standalone printable HTML for the browser's "Save as PDF".
export function toPrintableHtml(t: TableData, title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Arial,sans-serif;margin:32px;color:#111}
h1{font-size:18px;margin:0 0 2px}.meta{color:#666;font-size:12px;margin-bottom:18px}
table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ddd;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#4f46e5;color:#fff}tr:nth-child(even) td{background:#f7f7fb}
@media print{@page{margin:14mm}}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">${t.rows.length} record${t.rows.length !== 1 ? 's' : ''} · exported from OrbitAPI · ${new Date().toLocaleString()}</div>
${tableHtml(t)}
<script>window.onload=function(){window.print()}</script>
</body></html>`
}

// Aligned monospace text table (or key/value list for a single object).
export function toPlainText(t: TableData, title: string): string {
  if (!t.isCollection) {
    const w = Math.max(...t.rows.map(r => cell(r.field).length), 5)
    const lines = t.rows.map(r => `${cell(r.field).padEnd(w)}  ${cell(r.value)}`)
    return `${title}\n${'='.repeat(title.length)}\n\n${lines.join('\n')}\n`
  }
  const widths = t.columns.map(c => Math.max(c.length, ...t.rows.map(r => cell(r[c]).length)))
  const fmt = (vals: unknown[]) => vals.map((v, i) => cell(v).padEnd(widths[i])).join('  ')
  const sep = widths.map(w => '-'.repeat(w)).join('  ')
  return [
    `${title}  (${t.rows.length} record${t.rows.length !== 1 ? 's' : ''})`,
    '',
    fmt(t.columns),
    sep,
    ...t.rows.map(r => fmt(t.columns.map(c => r[c]))),
    '',
  ].join('\n')
}

// ── Download / open helpers (browser only) ────────────────────────────────────

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function openPrintable(html: string) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}

// A run can have several successful read steps. Pick the single result that
// yields the richest table (the main list the user wanted) so exports come out
// as proper rows — never wrap the results in an array, which would make toTable
// treat the wrapper as the table and stringify the real rows into one cell.
export function bestResult(candidates: unknown[]): unknown | null {
  const valid = candidates.filter(
    r => r != null && typeof r === 'object' && !('error' in (r as object)),
  )
  if (valid.length === 0) return null
  let best = valid[0]
  let bestRows = toTable(best).rows.length
  for (let i = 1; i < valid.length; i++) {
    const rows = toTable(valid[i]).rows.length
    if (rows > bestRows) { best = valid[i]; bestRows = rows }
  }
  return best
}

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'word' | 'text' | 'json'

export function exportAs(format: ExportFormat, data: unknown, baseName: string) {
  const t = toTable(data)
  const title = baseName.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const stamp = new Date().toISOString().slice(0, 10)
  const file = `${baseName}_${stamp}`
  switch (format) {
    case 'csv':   return downloadBlob(toCSV(t), `${file}.csv`, 'text/csv;charset=utf-8')
    case 'excel': return downloadBlob(toExcelHtml(t, title), `${file}.xls`, 'application/vnd.ms-excel')
    case 'word':  return downloadBlob(toWordHtml(t, title), `${file}.doc`, 'application/msword')
    case 'text':  return downloadBlob(toPlainText(t, title), `${file}.txt`, 'text/plain;charset=utf-8')
    case 'json':  return downloadBlob(JSON.stringify(unwrapEnvelope(data), null, 2), `${file}.json`, 'application/json')
    case 'pdf':   return openPrintable(toPrintableHtml(t, title))
  }
}
