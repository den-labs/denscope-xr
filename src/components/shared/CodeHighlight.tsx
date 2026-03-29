type Token = { text: string; className: string }

const KEYWORD_RE = /\b(const|let|var|import|from|export|async|await|function|return|if|else|try|catch|throw|new|typeof|instanceof)\b/g
const STRING_RE = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g
const COMMENT_RE = /(\/\/.*$|#.*$)/gm
const NUMBER_RE = /\b(\d+(?:\.\d+)?)\b/g
const PROPERTY_RE = /\.(\w+)/g
const CURL_FLAG_RE = /(\s-[A-Za-z]+\b)/g

function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  const markers: { start: number; end: number; className: string }[] = []

  function mark(re: RegExp, className: string, group = 0) {
    let m: RegExpExecArray | null
    const r = new RegExp(re.source, re.flags)
    while ((m = r.exec(code)) !== null) {
      const idx = group > 0 ? (m.index + m[0].indexOf(m[group])) : m.index
      markers.push({ start: idx, end: idx + m[group].length, className })
    }
  }

  // Order matters: comments first (highest priority), then strings, then others
  mark(COMMENT_RE, 'text-emerald-400', 1)
  mark(STRING_RE, 'text-emerald-400/80', 1)
  mark(KEYWORD_RE, 'text-accent/70', 1)
  mark(NUMBER_RE, 'text-amber-400/70', 1)
  mark(CURL_FLAG_RE, 'text-accent/70', 1)

  // Sort by start, resolve overlaps (first match wins)
  markers.sort((a, b) => a.start - b.start)

  let pos = 0
  for (const m of markers) {
    if (m.start < pos) continue // skip overlapping
    if (m.start > pos) {
      tokens.push({ text: code.slice(pos, m.start), className: 'text-text-primary' })
    }
    tokens.push({ text: code.slice(m.start, m.end), className: m.className })
    pos = m.end
  }
  if (pos < code.length) {
    tokens.push({ text: code.slice(pos), className: 'text-text-primary' })
  }

  return tokens
}

export function CodeHighlight({ children }: { children: string }) {
  const tokens = tokenize(children)

  return (
    <pre className="bg-bg border border-border rounded-lg p-4 mt-2 overflow-x-auto">
      <code className="text-xs font-mono leading-relaxed whitespace-pre">
        {tokens.map((t, i) => (
          <span key={i} className={t.className}>{t.text}</span>
        ))}
      </code>
    </pre>
  )
}
