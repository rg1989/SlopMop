import React from 'react';

interface AttachBarProps {
  attachments: string[];
  onRemove: (path: string) => void;
}

export function AttachBar({ attachments, onRemove }: AttachBarProps): React.ReactElement | null {
  if (attachments.length === 0) return null;

  return (
    <div className="attach-bar">
      {attachments.map((p) => (
        <div key={p} className="attach-chip">
          <span>{p.split('/').pop()}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(p); }}
            aria-label={`Remove ${p.split('/').pop()}`}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
