import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface RuleFile {
  id: string;
  path: string;
  displayPath: string;
  scope: 'global' | 'project' | 'import';
  parentId?: string;
  content: string;
  imports: string[];
}

interface RulesModalProps {
  cwd: string | null;
  onClose: () => void;
}

function RulesIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="16" y2="17"/>
      <line x1="8" y1="9" x2="10" y2="9"/>
    </svg>
  );
}

function ScopeLabel({ scope }: { scope: 'global' | 'project' | 'import' }) {
  const labels = { global: 'global', project: 'project', import: 'import' };
  return <span className={`rules-scope-badge rules-scope-badge--${scope}`}>{labels[scope]}</span>;
}

function basename(p: string) {
  return p.split('/').filter(Boolean).pop() ?? p;
}

export function RulesModal({ cwd, onClose }: RulesModalProps) {
  const [files, setFiles] = useState<RuleFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawMode, setRawMode] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = cwd ? `/api/rules?cwd=${encodeURIComponent(cwd)}` : '/api/rules';
    fetch(url)
      .then(r => r.json())
      .then(({ files: f }: { files: RuleFile[] }) => {
        setFiles(f);
        if (f.length > 0) setSelectedId(f[0].id);
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [cwd]);

  const selected = files.find(f => f.id === selectedId) ?? null;

  useEffect(() => {
    setHighlightedHtml(null);
    if (!selected) return;
    let cancelled = false;
    fetch('/api/highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: selected.content, lang: 'markdown' }),
    })
      .then(r => r.json())
      .then(({ html }: { html: string | null }) => { if (!cancelled && html) setHighlightedHtml(html); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selected?.id, selected?.content]);

  const globalFiles = files.filter(f => f.scope === 'global');
  const projectFiles = files.filter(f => f.scope === 'project');
  const importFiles = files.filter(f => f.scope === 'import');

  function TreeItem({ file, depth = 0 }: { file: RuleFile; depth?: number }) {
    const isSelected = selectedId === file.id;
    const children = importFiles.filter(f => f.parentId === file.id);
    return (
      <>
        <button
          className={`rules-tree-item${isSelected ? ' rules-tree-item--active' : ''}`}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          onClick={() => setSelectedId(file.id)}
          title={file.path}
        >
          {depth > 0 && <span className="rules-tree-indent-line" />}
          <RulesIcon size={11} color={isSelected ? '#d4845a' : '#6e7681'} />
          <span className="rules-tree-name">{basename(file.displayPath)}</span>
          <ScopeLabel scope={file.scope} />
        </button>
        {children.map(child => (
          <TreeItem key={child.id} file={child} depth={depth + 1} />
        ))}
      </>
    );
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel rules-modal" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div className="rules-modal-title-row">
            <RulesIcon size={14} color="#d4845a" />
            <span className="modal-title">Rules</span>
            {selected && (
              <span className="rules-modal-path">{selected.displayPath}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={`rules-raw-btn${rawMode ? ' rules-raw-btn--active' : ''}`}
              onClick={() => setRawMode(m => !m)}
              title="Toggle raw markdown"
            >
              raw
            </button>
            <button className="modal-close-btn" onClick={onClose} title="Close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="rules-body">
          <div className="rules-tree">
            {loading ? (
              <div className="rules-tree-empty">Loading…</div>
            ) : files.length === 0 ? (
              <div className="rules-tree-empty">No rules files found</div>
            ) : (
              <>
                {globalFiles.length > 0 && (
                  <div className="rules-tree-section">
                    <div className="rules-tree-section-label">Global</div>
                    {globalFiles.map(f => (
                      <TreeItem key={f.id} file={f} depth={0} />
                    ))}
                  </div>
                )}
                {projectFiles.length > 0 && (
                  <div className="rules-tree-section">
                    <div className="rules-tree-section-label">Project</div>
                    {projectFiles.map(f => (
                      <TreeItem key={f.id} file={f} depth={0} />
                    ))}
                  </div>
                )}
                {importFiles.filter(f => !f.parentId || (!globalFiles.find(g => g.id === f.parentId) && !projectFiles.find(p => p.id === f.parentId))).length > 0 && (
                  <div className="rules-tree-section">
                    <div className="rules-tree-section-label">Imports</div>
                    {importFiles
                      .filter(f => !f.parentId || (!globalFiles.find(g => g.id === f.parentId) && !projectFiles.find(p => p.id === f.parentId)))
                      .map(f => <TreeItem key={f.id} file={f} depth={0} />)}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rules-content">
            {loading ? (
              <div className="rules-content-empty">
                <div className="rules-loading-dots">
                  <span /><span /><span />
                </div>
              </div>
            ) : !selected ? (
              <div className="rules-content-empty">Select a file to view</div>
            ) : rawMode ? (
              <pre className="rules-raw">{selected.content}</pre>
            ) : highlightedHtml ? (
              <div className="fp-shiki rules-shiki" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
            ) : (
              <pre className="rules-raw">{selected.content}</pre>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
