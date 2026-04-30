import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mockSpeechSynthesis } from './setup';
import { useTts } from '../client/hooks/useTts';

describe('useTts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpeechSynthesis.speaking = false;
  });

  it('TTS-02: stop() calls speechSynthesis.cancel() once', () => {
    const { result } = renderHook(() => useTts({ enabled: true }));
    act(() => {
      result.current.stop();
    });
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalledTimes(1);
  });

  it('TTS-01: handleData with ANSI codes strips them and speaks complete sentence', () => {
    const { result } = renderHook(() => useTts({ enabled: true }));
    act(() => {
      result.current.handleData('\x1b[32mHello world.\x1b[0m ');
    });
    expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
    expect(utterance.text).toBe('Hello world.');
  });

  it('TTS-01: handleData with enabled:false is a no-op — speak not called', () => {
    const { result } = renderHook(() => useTts({ enabled: false }));
    act(() => {
      result.current.handleData('Hello world. ');
    });
    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('TTS-01: handleData with partial sentence (no terminator) does not speak', () => {
    const { result } = renderHook(() => useTts({ enabled: true }));
    act(() => {
      result.current.handleData('Hello');
    });
    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
  });
});
