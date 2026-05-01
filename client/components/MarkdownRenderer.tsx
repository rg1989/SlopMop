import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// ── Mermaid — initialised once ───────────────────────────────────────────────

let mermaidReady = false;
function ensureMermaid() {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace',
    flowchart: { curve: 'basis', useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });
  mermaidReady = true;
}

let mermaidSeq = 0;

function MermaidBlock({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(`md-mermaid-${++mermaidSeq}`);

  useEffect(() => {
    ensureMermaid();
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    el.innerHTML = '';
    mermaid.render(idRef.current, content.trim()).then(({ svg }) => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = svg;
      const svgEl = ref.current.querySelector('svg');
      if (svgEl) {
        // Keep Mermaid's natural max-width (the diagram's intrinsic rendered width).
        // Set width:100% so it shrinks in narrow containers, height:auto for proportion.
        // Never override maxWidth — that's what was causing unbounded growth.
        svgEl.removeAttribute('height');
        svgEl.style.width = '100%';
        svgEl.style.height = 'auto';
      }
    }).catch(() => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = `<pre class="md-code-block"><code>${escHtml(content)}</code></pre>`;
    });
    return () => { cancelled = true; };
  }, [content]);

  return <div ref={ref} className="mermaid-block" />;
}

// ── Inline HTML ───────────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineHtml(text: string): string {
  return escHtml(text)
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

// ── Block parser ──────────────────────────────────────────────────────────────

type Block =
  | { k: 'h'; level: number; text: string }
  | { k: 'p'; text: string }
  | { k: 'mermaid'; content: string }
  | { k: 'code'; lang: string; content: string }
  | { k: 'ul'; items: string[] }
  | { k: 'ol'; items: string[] }
  | { k: 'quote'; text: string }
  | { k: 'hr' }
  | { k: 'table'; head: string[]; rows: string[][] };

function parseBlocks(md: string): Block[] {
  const lines = md.split('\n');
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = line.match(/^(`{3,}|~{3,})(.*)/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const lang = fenceMatch[2].trim().toLowerCase();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) { body.push(lines[i]); i++; }
      i++;
      const content = body.join('\n');
      out.push(lang === 'mermaid' ? { k: 'mermaid', content } : { k: 'code', lang, content });
      continue;
    }

    // Heading
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) { out.push({ k: 'h', level: hm[1].length, text: hm[2].replace(/\s+#+\s*$/, '') }); i++; continue; }

    // HR
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push({ k: 'hr' }); i++; continue; }

    // Blockquote
    if (line.startsWith('> ') || line === '>') {
      const qLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        qLines.push(lines[i].replace(/^> ?/, '')); i++;
      }
      out.push({ k: 'quote', text: qLines.join('\n') });
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s\-:|]+\|/.test(lines[i + 1])) {
      const parseRow = (r: string) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = parseRow(line);
      i += 2; // skip separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) { rows.push(parseRow(lines[i])); i++; }
      out.push({ k: 'table', head, rows });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s/, '')); i++;
      }
      out.push({ k: 'ul', items }); continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, '')); i++;
      }
      out.push({ k: 'ol', items }); continue;
    }

    // Empty line
    if (!line.trim()) { i++; continue; }

    // Paragraph — collect until blank or block-starting line
    const paraLines: string[] = [];
    while (
      i < lines.length && lines[i].trim() &&
      !lines[i].match(/^(`{3,}|~{3,})/) &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].match(/^[-*+]\s/) &&
      !lines[i].match(/^\d+\.\s/) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !lines[i].startsWith('> ')
    ) { paraLines.push(lines[i]); i++; }
    if (paraLines.length) out.push({ k: 'p', text: paraLines.join(' ') });
  }

  return out;
}

// ── Shiki code block ─────────────────────────────────────────────────────────

function ShikiCodeBlock({ lang, content }: { lang: string; content: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!lang) return;
    let cancelled = false;
    fetch('/api/highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, lang }),
    })
      .then(r => r.json())
      .then(({ html: h }: { html: string | null }) => { if (!cancelled && h) setHtml(h); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lang, content]);

  if (html) {
    return (
      <div className="md-code-block md-code-block--shiki">
        {lang && <span className="md-code-lang">{lang}</span>}
        <div className="fp-shiki" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  return (
    <pre className="md-code-block">
      {lang && <span className="md-code-lang">{lang}</span>}
      <code>{content}</code>
    </pre>
  );
}

// ── MarkdownRenderer ──────────────────────────────────────────────────────────

export function MarkdownRenderer({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="md-body">
      {blocks.map((b, idx) => {
        switch (b.k) {
          case 'h': {
            const Tag = `h${b.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
            return <Tag key={idx} className={`md-h${b.level}`} dangerouslySetInnerHTML={{ __html: inlineHtml(b.text) }} />;
          }
          case 'p':
            return <p key={idx} className="md-p" dangerouslySetInnerHTML={{ __html: inlineHtml(b.text) }} />;
          case 'mermaid':
            return <MermaidBlock key={`${idx}-${b.content.slice(0, 20)}`} content={b.content} />;
          case 'code':
            return <ShikiCodeBlock key={idx} lang={b.lang} content={b.content} />;
          case 'ul':
            return <ul key={idx} className="md-ul">{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: inlineHtml(it) }} />)}</ul>;
          case 'ol':
            return <ol key={idx} className="md-ol">{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: inlineHtml(it) }} />)}</ol>;
          case 'quote':
            return <blockquote key={idx} className="md-blockquote"><MarkdownRenderer content={b.text} /></blockquote>;
          case 'hr':
            return <hr key={idx} className="md-hr" />;
          case 'table':
            return (
              <div key={idx} className="md-table-wrap">
                <table className="md-table">
                  <thead><tr>{b.head.map((h, j) => <th key={j} dangerouslySetInnerHTML={{ __html: inlineHtml(h) }} />)}</tr></thead>
                  <tbody>{b.rows.map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k} dangerouslySetInnerHTML={{ __html: inlineHtml(cell) }} />)}</tr>)}</tbody>
                </table>
              </div>
            );
          default: return null;
        }
      })}
    </div>
  );
}
