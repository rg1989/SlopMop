import { useState } from 'react';

interface FolderPickerProps {
  initialPath?: string;
  onConnect: (cwd: string) => void;
}

export function FolderPicker({ initialPath, onConnect }: FolderPickerProps) {
  const [path, setPath] = useState(initialPath ?? '');
  const [picking, setPicking] = useState(false);

  const handleBrowse = async () => {
    setPicking(true);
    try {
      const res = await fetch('/api/pick-folder', { method: 'POST' });
      if (res.ok) {
        const { path: selected } = await res.json();
        setPath(selected);
        onConnect(selected);
      }
    } finally {
      setPicking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = path.trim();
    if (trimmed) onConnect(trimmed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
    >
      <button
        type="button"
        onClick={handleBrowse}
        disabled={picking}
        style={{
          padding: '6px 14px',
          background: '#21262d',
          color: picking ? '#484f58' : '#c9d1d9',
          border: '1px solid #30363d',
          borderRadius: '6px',
          fontSize: '13px',
          cursor: picking ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {picking ? 'Choosing…' : '📁 Choose Folder'}
      </button>
      <input
        type="text"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder="/path/to/your/project"
        style={{
          flex: 1,
          padding: '6px 10px',
          background: '#0d1117',
          color: '#c9d1d9',
          border: '1px solid #30363d',
          borderRadius: '6px',
          fontFamily: 'monospace',
          fontSize: '13px',
          outline: 'none',
          minWidth: 0,
        }}
      />
    </form>
  );
}
