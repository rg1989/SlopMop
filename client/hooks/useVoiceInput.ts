import { useState, useRef, useCallback } from 'react';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onStart?: () => void;
}

interface UseVoiceInputReturn {
  recording: boolean;
  start: () => void;
  stop: () => void;
  supported: boolean;
}

export function useVoiceInput({ onTranscript, onStart }: UseVoiceInputOptions): UseVoiceInputReturn {
  const [recording, setRecording] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  const SR = (window as Window & typeof globalThis & {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }).SpeechRecognition ?? (window as Window & typeof globalThis & {
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }).webkitSpeechRecognition;

  const supported = !!SR;

  const start = useCallback(() => {
    if (!SR) return;
    onStart?.();                 // TTS-04: stop TTS before mic opens
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;  // final results only — simpler state
    rec.continuous = false;      // single utterance; new instance per call
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[e.results.length - 1][0].transcript;
      onTranscript(text);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }, [SR, onStart, onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  }, []);

  return { recording, start, stop, supported };
}
