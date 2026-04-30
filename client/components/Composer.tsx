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

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    const atPaths = (attachments ?? []).map(p => `@${p}`).join(' ');
    const fullMessage = atPaths ? `${atPaths}\n${value}` : value;
    onSend(fullMessage + '\r');
    clearAttachments?.();
    setValue('');
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
          padding: '8px 36px 8px 8px',
          boxSizing: 'border-box',
          background: '#161b22',
          color: '#c9d1d9',
          border: '1px solid #30363d',
          borderRadius: '6px',
        }}
      />
      <div style={{
        position: 'absolute',
        right: '8px',
        bottom: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
      }}>
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          title="Send message (Enter)"
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
            padding: '2px',
            color: disabled || !value.trim() ? '#484f58' : '#d4845a',
            lineHeight: 1,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
        {onAttach && (
          <button
            type="button"
            onClick={handlePaperclip}
            disabled={picking}
            title="Attach file(s)"
            style={{
              background: 'none',
              border: 'none',
              cursor: picking ? 'not-allowed' : 'pointer',
              padding: '2px',
              color: picking ? '#484f58' : (disabled ? '#484f58' : '#8b949e'),
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
    </div>
  );
});
