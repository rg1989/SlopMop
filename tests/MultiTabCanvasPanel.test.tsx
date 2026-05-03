import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// @ts-expect-error — module does not exist yet (Wave 0 RED)
import { MultiTabCanvasPanel } from '../client/components/MultiTabCanvasPanel';

const mockTabs = [
  { id: 'tab-1', title: 'Analysis', html: '<p>hi</p>', locked: false },
  { id: 'tab-2', title: 'Progress', html: '<p>hello</p>', locked: true, lockReason: 'running task' },
];

describe('MultiTabCanvasPanel', () => {
  it('CANVASTAB-01: renders tab chips with .bpanel-tab class', () => {
    render(<MultiTabCanvasPanel tabs={mockTabs} activeId="tab-1" onClose={vi.fn()} onActivate={vi.fn()} />);
    const tabs = document.querySelectorAll('.bpanel-tab');
    expect(tabs.length).toBe(2);
  });

  it('CANVASTAB-01: active tab has .bpanel-tab--active class', () => {
    render(<MultiTabCanvasPanel tabs={mockTabs} activeId="tab-1" onClose={vi.fn()} onActivate={vi.fn()} />);
    const active = document.querySelector('.bpanel-tab--active');
    expect(active).not.toBeNull();
    expect(active?.textContent).toContain('Analysis');
  });

  it('CANVASTAB-02: no + button visible', () => {
    render(<MultiTabCanvasPanel tabs={mockTabs} activeId="tab-1" onClose={vi.fn()} onActivate={vi.fn()} />);
    expect(screen.queryByText('+')).toBeNull();
  });

  it('CANVASTAB-03: clicking x on locked tab shows ConfirmModal', () => {
    render(<MultiTabCanvasPanel tabs={mockTabs} activeId="tab-2" onClose={vi.fn()} onActivate={vi.fn()} />);
    const closeButtons = document.querySelectorAll('.bpanel-tab-close');
    fireEvent.click(closeButtons[1]);
    expect(screen.getByText(/Force Close/i)).toBeInTheDocument();
  });

  it('CANVASTAB-03: clicking x on unlocked tab calls onClose immediately', () => {
    const onClose = vi.fn();
    render(<MultiTabCanvasPanel tabs={mockTabs} activeId="tab-1" onClose={onClose} onActivate={vi.fn()} />);
    const closeButtons = document.querySelectorAll('.bpanel-tab-close');
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledWith('tab-1');
  });
});
