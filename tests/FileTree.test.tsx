import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTree } from '../client/components/FileTree';
import type { FileNode } from '../client/components/FileTree';

// Minimal test fixture: one directory containing two files
const testTree: FileNode[] = [
  {
    name: 'src',
    path: '/test/project/src',
    type: 'dir',
    children: [
      { name: 'index.ts', path: '/test/project/src/index.ts', type: 'file' },
      { name: 'App.tsx', path: '/test/project/src/App.tsx', type: 'file' },
    ],
  },
];

describe('FileTree', () => {
  it('renders file tree — shows directory name and file names', () => {
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onSelect={vi.fn()}
        onPreview={vi.fn()}
        changedPaths={new Set<string>()}
      />
    );

    expect(screen.getByText('src')).toBeTruthy();
    expect(screen.getByText('index.ts')).toBeTruthy();
    expect(screen.getByText('App.tsx')).toBeTruthy();
  });

  it('toggle dir — clicking directory header collapses children; clicking again expands', () => {
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onSelect={vi.fn()}
        onPreview={vi.fn()}
        changedPaths={new Set<string>()}
      />
    );

    // Children are visible initially
    expect(screen.getByText('index.ts')).toBeTruthy();

    // Click directory header to collapse
    const dirHeader = screen.getByText('src').closest('[class*="ft-dir-header"]') ?? screen.getByText('src');
    fireEvent.click(dirHeader);

    // Children should no longer be visible
    expect(screen.queryByText('index.ts')).toBeNull();
    expect(screen.queryByText('App.tsx')).toBeNull();

    // Click again to expand
    fireEvent.click(dirHeader);

    expect(screen.getByText('index.ts')).toBeTruthy();
    expect(screen.getByText('App.tsx')).toBeTruthy();
  });

  it('changedPaths highlights changed file — element has ft-changed class', () => {
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onSelect={vi.fn()}
        onPreview={vi.fn()}
        changedPaths={new Set(['/test/project/src/index.ts'])}
      />
    );

    const fileEl = screen.getByText('index.ts').closest('[class*="ft-file"]') ?? screen.getByText('index.ts').parentElement;
    expect(fileEl?.className).toContain('ft-changed');
  });

  it('select file adds to selection — double-clicking a file calls onSelect with absolute path', () => {
    const onSelect = vi.fn();
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onSelect={onSelect}
        onPreview={vi.fn()}
        changedPaths={new Set<string>()}
      />
    );

    const fileEl = screen.getByText('index.ts');
    fireEvent.doubleClick(fileEl);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('/test/project/src/index.ts');
  });

  it('preview click — single-clicking a file calls onPreview with absolute path', () => {
    const onPreview = vi.fn();
    render(
      <FileTree
        nodes={testTree}
        selected={new Set<string>()}
        onSelect={vi.fn()}
        onPreview={onPreview}
        changedPaths={new Set<string>()}
      />
    );

    const fileEl = screen.getByText('App.tsx');
    fireEvent.click(fileEl);

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith('/test/project/src/App.tsx');
  });
});
