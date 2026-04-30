import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilePreview } from '../client/components/FilePreview';
import type { FilePreviewData } from '../client/components/FilePreview';

describe('FilePreview', () => {
  it('renders text content — text response shows content in pre/code element', () => {
    const data: FilePreviewData = { type: 'text', content: 'hello world' };
    render(<FilePreview data={data} />);

    // Text content should appear inside a pre or code element
    const textEl = screen.getByText('hello world');
    expect(textEl).toBeTruthy();
    const tag = textEl.tagName.toLowerCase();
    const parent = textEl.parentElement?.tagName.toLowerCase();
    expect(['pre', 'code'].includes(tag) || ['pre', 'code'].includes(parent ?? '')).toBe(true);
  });

  it('renders image tag for binary image — img element with correct src', () => {
    const data: FilePreviewData = {
      type: 'binary',
      isImage: true,
      base64: 'abc',
      ext: '.png',
    };
    render(<FilePreview data={data} />);

    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain('data:image/png;base64,abc');
  });

  it('renders binary message for non-image binary — shows notice, no img tag', () => {
    const data: FilePreviewData = {
      type: 'binary',
      isImage: false,
      ext: '.zip',
    };
    render(<FilePreview data={data} />);

    expect(screen.queryByRole('img')).toBeNull();
    // Should render a "Binary file" or similar notice
    const notice = screen.getByText(/binary file/i);
    expect(notice).toBeTruthy();
  });

  it('renders nothing when content is null — null prop renders empty/null', () => {
    const { container } = render(<FilePreview data={null} />);
    expect(container.firstChild).toBeNull();
  });
});
