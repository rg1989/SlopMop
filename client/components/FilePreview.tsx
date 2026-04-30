import React from 'react';

export type FilePreviewData =
  | { type: 'text'; content: string }
  | { type: 'binary'; isImage: true; base64: string; ext: string }
  | { type: 'binary'; isImage: false; ext: string };

interface FilePreviewProps {
  data: FilePreviewData | null;
}

function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    default: return 'image/png';
  }
}

export function FilePreview({ data }: FilePreviewProps): React.ReactElement | null {
  if (data === null) return null;

  if (data.type === 'text') {
    return (
      <div className="file-preview">
        <pre className="fp-text">{data.content}</pre>
      </div>
    );
  }

  if (data.isImage) {
    const mime = getMimeType(data.ext);
    return (
      <img
        className="fp-image"
        src={`data:${mime};base64,${data.base64}`}
        alt="preview"
        style={{ maxWidth: '100%' }}
      />
    );
  }

  return <div className="fp-binary">Binary file ({data.ext})</div>;
}
