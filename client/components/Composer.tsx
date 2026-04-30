import { useState, KeyboardEvent, forwardRef } from 'react';

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  attachments?: string[];
  clearAttachments?: () => void;
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  function Composer({ onSend, disabled = false, attachments, clearAttachments }, ref) {
  const [value, setValue] = useState('');

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

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
      rows={3}
      style={{
        width: '100%',
        resize: 'vertical',
        fontFamily: 'monospace',
        fontSize: '14px',
        padding: '8px',
        boxSizing: 'border-box',
        background: '#161b22',
        color: '#c9d1d9',
        border: '1px solid #30363d',
        borderRadius: '6px',
      }}
    />
  );
});
