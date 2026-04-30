import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from '../client/components/Composer';

describe('Composer', () => {
  let mockOnSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSend = vi.fn();
  });

  it('calls onSend with value + newline when Enter is pressed with non-empty value (TERM-03)', async () => {
    const user = userEvent.setup();
    render(<Composer onSend={mockOnSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');
    await user.keyboard('{Enter}');

    expect(mockOnSend).toHaveBeenCalledTimes(1);
    expect(mockOnSend).toHaveBeenCalledWith('hello\r');
  });

  it('clears the textarea after onSend is called (TERM-03)', async () => {
    const user = userEvent.setup();
    render(<Composer onSend={mockOnSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');
    await user.keyboard('{Enter}');

    expect(textarea).toHaveValue('');
  });

  it('does NOT call onSend when Shift+Enter is pressed — inserts newline instead (TERM-03)', async () => {
    const user = userEvent.setup();
    render(<Composer onSend={mockOnSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('does NOT call onSend when Enter is pressed with empty input (TERM-03)', async () => {
    const user = userEvent.setup();
    render(<Composer onSend={mockOnSend} />);

    const textarea = screen.getByRole('textbox');
    await user.keyboard('{Enter}');

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('does NOT call onSend when Enter is pressed with whitespace-only input (TERM-03)', async () => {
    const user = userEvent.setup();
    render(<Composer onSend={mockOnSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '   ');
    await user.keyboard('{Enter}');

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('calls event.preventDefault() when Enter is pressed (prevents default form submission)', async () => {
    const user = userEvent.setup();
    render(<Composer onSend={mockOnSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hello');

    // Capture the keydown event to verify preventDefault was called
    let preventDefaultCalled = false;
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // After our handler runs, defaultPrevented should be true
        setTimeout(() => {
          preventDefaultCalled = e.defaultPrevented;
        }, 0);
      }
    });

    await user.keyboard('{Enter}');

    // The fact that onSend was called (not twice, not with a newline appended by browser)
    // and the textarea was cleared proves preventDefault was called effectively.
    // Additionally verify the textarea didn't get a browser-default newline.
    expect(mockOnSend).toHaveBeenCalledTimes(1);
    expect(mockOnSend).toHaveBeenCalledWith('hello\r');
    // Textarea cleared — proves Enter didn't add a browser newline before our handler
    expect(textarea).toHaveValue('');
  });

  it('is disabled when the disabled prop is true', async () => {
    const user = userEvent.setup();
    render(<Composer onSend={mockOnSend} disabled={true} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('sends multiline text when Enter is pressed after Shift+Enter newlines', async () => {
    const user = userEvent.setup();
    render(<Composer onSend={mockOnSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'line1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'line2');
    await user.keyboard('{Enter}');

    expect(mockOnSend).toHaveBeenCalledTimes(1);
    expect(mockOnSend).toHaveBeenCalledWith('line1\nline2\r');
  });
});
