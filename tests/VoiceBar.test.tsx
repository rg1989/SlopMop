// @ts-expect-error — module does not exist yet (Wave 0 stub)
import { VoiceBar } from '../client/components/VoiceBar';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

describe('VoiceBar — TTS-04 mutual exclusion', () => {
  it('TTS-04: clicking mic button calls onMicStart', () => {
    const onMicStart = vi.fn();
    const onStop = vi.fn();
    const { getByTitle } = render(
      <VoiceBar
        recording={false}
        speaking={false}
        ttsEnabled={true}
        onMicStart={onMicStart}
        onMicStop={vi.fn()}
        onTtsToggle={vi.fn()}
        onTtsStop={onStop}
      />
    );
    fireEvent.click(getByTitle(/record/i));
    expect(onMicStart).toHaveBeenCalledTimes(1);
  });

  it('TTS-02: clicking stop TTS button calls onTtsStop', () => {
    const onTtsStop = vi.fn();
    const { getByTitle } = render(
      <VoiceBar
        recording={false}
        speaking={true}
        ttsEnabled={true}
        onMicStart={vi.fn()}
        onMicStop={vi.fn()}
        onTtsToggle={vi.fn()}
        onTtsStop={onTtsStop}
      />
    );
    fireEvent.click(getByTitle(/stop/i));
    expect(onTtsStop).toHaveBeenCalledTimes(1);
  });
});
