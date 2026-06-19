import React from 'react'

// Lightweight, dependency-free Markdown renderer for assistant replies.
// Builds real React elements (no dangerouslySetInnerHTML, so no XSS), handling
// the subset the model actually emits: **bold**, *italic*, `code`, [links](url),
// headings, and ordered/unordered lists. Deliberately small — we don't need a
// full CommonMark engine, and adding one risks React 19 peer-dep friction.

// Only allow safe link targets (relative or http/https) — never javascript:, etc.
function safeHref(href: string): string | null {
  const h = href.trim()
  if (h.startsWith('/') || h.startsWith('#')) return h
  if (/^https?:\/\//i.test(h)) return h
  if (/^mailto:/i.test(h)) return h
  return null
}

// Inline formatting within a single line.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Order matters: bold/code/link before single-char italic.
  const re = /\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*\n]+)\*|_([^_\n]+)_/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const key = `${keyBase}-${i++}`
    if (m[1] ?? m[2]) {
      nodes.push(<strong key={key} className="font-semibold">{m[1] ?? m[2]}</strong>)
    } else if (m[3]) {
      nodes.push(<code key={key} className="rounded bg-black/20 px-1 py-0.5 text-[0.85em] font-mono">{m[3]}</code>)
    } else if (m[4] && m[5]) {
      const href = safeHref(m[5])
      nodes.push(href
        ? <a key={key} href={href} className="underline underline-offset-2 hover:opacity-80">{m[4]}</a>
        : m[4])
    } else if (m[6] ?? m[7]) {
      nodes.push(<em key={key}>{m[6] ?? m[7]}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line — skip (acts as a block separator).
    if (!line.trim()) { i++; continue }

    // Heading (#, ##, ###).
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      const cls = level === 1 ? 'text-base font-semibold' : level === 2 ? 'text-sm font-semibold' : 'text-sm font-medium'
      blocks.push(<p key={key++} className={`${cls} mt-1`}>{renderInline(h[2], `h${key}`)}</p>)
      i++
      continue
    }

    // Ordered list (consecutive "N." lines).
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*\d+\.\s+/, '')
        items.push(<li key={items.length}>{renderInline(content, `ol${key}-${items.length}`)}</li>)
        i++
      }
      blocks.push(<ol key={key++} className="list-decimal pl-5 space-y-0.5">{items}</ol>)
      continue
    }

    // Unordered list (consecutive "- " or "* " lines).
    if (/^\s*[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*[-*]\s+/, '')
        items.push(<li key={items.length}>{renderInline(content, `ul${key}-${items.length}`)}</li>)
        i++
      }
      blocks.push(<ul key={key++} className="list-disc pl-5 space-y-0.5">{items}</ul>)
      continue
    }

    // Paragraph — gather consecutive non-blank, non-list, non-heading lines.
    const para: string[] = []
    while (
      i < lines.length && lines[i].trim() &&
      !/^\s*\d+\.\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^#{1,3}\s+/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++} className="leading-relaxed">
        {para.map((l, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {renderInline(l, `p${key}-${li}`)}
          </React.Fragment>
        ))}
      </p>,
    )
  }

  return <div className={`space-y-2 ${className ?? ''}`}>{blocks}</div>
}
