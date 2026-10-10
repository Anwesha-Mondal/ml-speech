import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Minimal Markdown for the legal pages: headings, paragraphs, bullet lists, tables,
 * **bold**, `code` and [links](url). It builds React elements (never innerHTML), and only
 * http(s) and in-app links are allowed, so document text can't inject script.
 */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${key}-${i++}`
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>)
    else if (m[4]) out.push(<code key={k}>{m[4]}</code>)
    else if (m[6] && m[7]) {
      const href = m[7]
      if (href.startsWith('/') && !href.startsWith('//')) out.push(<Link key={k} to={href}>{m[6]}</Link>)
      else if (/^https?:\/\//i.test(href))
        out.push(
          <a key={k} href={href} target="_blank" rel="noopener noreferrer">
            {m[6]}
          </a>,
        )
      else out.push(m[6])
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function cells(row: string): string[] {
  return row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let n = 0
  while (i < lines.length) {
    const line = lines[i]
    const k = `b${n++}`
    if (!line.trim()) {
      i++
    } else if (/^#{1,3} /.test(line)) {
      const level = line.match(/^#+/)![0].length
      const text = line.replace(/^#+ /, '')
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      blocks.push(level === 1 ? <h2 key={k} id={id}>{inline(text, k)}</h2> : level === 2 ? <h2 key={k} id={id}>{inline(text, k)}</h2> : <h3 key={k} id={id}>{inline(text, k)}</h3>)
      i++
    } else if (line.trim().startsWith('|')) {
      const rows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++])
      const head = cells(rows[0])
      const body = rows.slice(2).map(cells)
      blocks.push(
        <div key={k} className="table-wrap legal-table">
          <table className="table">
            <thead>
              <tr>
                {head.map((h, j) => (
                  <th key={j}>{inline(h, `${k}h${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{inline(c, `${k}r${ri}c${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
    } else if (/^- /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2))
      blocks.push(
        <ul key={k}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${k}l${j}`)}</li>
          ))}
        </ul>,
      )
    } else {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() && !/^(#{1,3} |- |\|)/.test(lines[i].trim())) para.push(lines[i++].trim())
      blocks.push(<p key={k}>{inline(para.join(' '), k)}</p>)
    }
  }
  return <Fragment>{blocks}</Fragment>
}
