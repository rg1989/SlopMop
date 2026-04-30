import { useState, KeyboardEvent, forwardRef } from 'react';

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  attachments?: string[];
  clearAttachments?: () => void;
  onAttach?: (paths: string[]) => void;
  cwd?: string | null;
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  function Composer({ onSend, disabled = false, attachments, clearAttachments, onAttach, cwd }, ref) {
  const [value, setValue] = useState('');
  const [picking, setPicking] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) {
        const atPaths = (attachments ?? []).map(p => `@${p}`).join(' ');
        const fullMessage = atPaths ? `${atPaths}\n${value}` : value;
        onSend(fullMessage + '\r');
        clearAttachments?.();
        setValue('');
      }
    }
    // Shift+Enter: browser default inserts newline — no handler needed
  };

  const handlePaperclip = async () => {
    if (!onAttach || picking) return;
    setPicking(true);
    try {
      const res = await fetch('/api/pick-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd }),
      });
      if (res.ok) {
        const { paths } = await res.json() as { paths: string[] };
        if (paths.length > 0) onAttach(paths);
      }
    } finally {
      setPicking(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
        rows={3}
        style={{
          width: '100%',
          resize: 'vertical',
          fontFamily: 'monospace',
          fontSize: '14px',
          padding: '8px 40px 8px 8px',
          boxSizing: 'border-box',
          background: '#161b22',
          color: '#c9d1d9',
          border: '1px solid #30363d',
          borderRadius: '6px',
        }}
      />
      {onAttach && (
        <button
          type="button"
          onClick={handlePaperclip}
          disabled={disabled || picking}
          title="Attach file(s)"
          style={{
            position: 'absolute',
            right: '8px',
            bottom: '10px',
            background: 'none',
            border: 'none',
            cursor: disabled || picking ? 'not-allowed' : 'pointer',
            padding: '2px',
            color: picking ? '#484f58' : '#8b949e',
            lineHeight: 1,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
      )}
    </div>
  );
});
