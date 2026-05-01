import { useState, useRef, useCallback, useEffect, KeyboardEvent, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import SlashMenu, { SLASH_COMMANDS, SlashCommand } from './SlashMenu';

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  attachments?: string[];
  clearAttachments?: () => void;
  onAttach?: (paths: string[]) => void;
  cwd?: string | null;
  voiceSlot?: React.ReactNode;
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  function Composer({ onSend, disabled = false, attachments, clearAttachments, onAttach, cwd, voiceSlot }, ref) {
  const [value, setValue] = useState('');
  const [picking, setPicking] = useState(false);

  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashAnchor, setSlashAnchor] = useState(0);
  const [menuIndex, setMenuIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);

  const updateMenuRect = useCallback(() => {
    setMenuRect(textareaRef.current?.getBoundingClientRect() ?? null);
  }, []);

  useEffect(() => {
    if (slashQuery !== null) {
      updateMenuRect();
      window.addEventListener('scroll', updateMenuRect, true);
      window.addEventListener('resize', updateMenuRect);
      return () => {
        window.removeEventListener('scroll', updateMenuRect, true);
        window.removeEventListener('resize', updateMenuRect);
      };
    }
  }, [slashQuery, updateMenuRect]);

  const menuItems = slashQuery === null
    ? []
    : SLASH_COMMANDS.filter(c =>
        c.command.toLowerCase().includes(slashQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(slashQuery.toLowerCase())
      );

  const insertCommand = (cmd: SlashCommand) => {
    const ta = (ref as React.RefObject<HTMLTextAreaElement>).current;
    const pos = ta?.selectionStart ?? value.length;
    const before = value.slice(0, slashAnchor);
    const after = value.slice(pos);
    const newVal = before + cmd.command + ' ' + after;
    setValue(newVal);
    setSlashQuery(null);
    requestAnimationFrame(() => {
      if (ta) {
        const newPos = slashAnchor + cmd.command.length + 1;
        ta.setSelectionRange(newPos, newPos);
        ta.focus();
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setValue(val);

    const pos = e.target.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineText = before.slice(lineStart);

    if (lineText.startsWith('/')) {
      const query = lineText.slice(1);
      if (!query.includes(' ')) {
        setSlashQuery(query);
        setSlashAnchor(lineStart);
        setMenuIndex(0);
        return;
      }
    }
    setSlashQuery(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashQuery !== null && menuItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuIndex(i => Math.min(i + 1, menuItems.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertCommand(menuItems[menuIndex]);
        return;
      }
    }
    if (e.key === 'Escape' && slashQuery !== null) {
      e.preventDefault();
      setSlashQuery(null);
      return;
    }

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

  const setRefs = useCallback((el: HTMLTextAreaElement | null) => {
    (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  }, [ref]);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {slashQuery !== null && menuItems.length > 0 && menuRect && createPortal(
        <SlashMenu
          items={menuItems}
          selectedIndex={menuIndex}
          onSelect={insertCommand}
          onClose={() => setSlashQuery(null)}
          anchorRect={menuRect}
        />,
        document.body
      )}
      <textarea
        ref={setRefs}
        className="composer-input"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
        style={{
          width: '100%',
          resize: 'none',
          flex: 1,
          minHeight: 0,
          fontFamily: 'monospace',
          fontSize: '14px',
          padding: '8px 8px 34px 8px',
          boxSizing: 'border-box',
          background: '#161b22',
          color: '#c9d1d9',
        }}
      />
      <div style={{
        position: 'absolute',
        left: '6px',
        bottom: '6px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '2px',
      }}>
        <button
          type="button"
          className={`icon-btn${disabled || !value.trim() ? ' icon-btn-disabled' : ' icon-btn-accent'}`}
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          title="Send message (Enter)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
        {onAttach && (
          <button
            type="button"
            className={`icon-btn${picking || disabled ? ' icon-btn-disabled' : ''}`}
            onClick={handlePaperclip}
            disabled={picking}
            title="Attach file(s)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
        )}
        {voiceSlot}
      </div>
    </div>
  );
});
