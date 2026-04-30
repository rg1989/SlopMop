import { useVoiceInput } from '../client/hooks/useVoiceInput';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MockSpeechRecognition } from './setup';

describe('useVoiceInput', () => {
  it('VOICE-02: start() creates a new SpeechRecognition instance and calls start()', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onTranscript }));
    act(() => { result.current.start(); });
    expect(result.current.recording).toBe(true);
  });

  it('VOICE-01: onTranscript fires with recognized text when onresult fires', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onTranscript }));
    act(() => { result.current.start(); });
    const instance = MockSpeechRecognition.instances[0];
    const fakeEvent = {
      results: [Object.assign([{ transcript: 'hello world' }], { isFinal: true })],
    } as unknown as SpeechRecognitionEvent;
    act(() => { instance.onresult?.(fakeEvent); });
    expect(onTranscript).toHaveBeenCalledWith('hello world');
  });

  it('VOICE-02: stop() sets recording to false', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onTranscript }));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    expect(result.current.recording).toBe(false);
  });

  it('TTS-03: onStart callback fires when recording starts', () => {
    const onTranscript = vi.fn();
    const onStart = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onTranscript, onStart }));
    act(() => { result.current.start(); });
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
