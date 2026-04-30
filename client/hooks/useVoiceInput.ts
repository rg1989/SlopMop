import { useState, useRef, useCallback } from 'react';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onStart?: () => void;
}

interface UseVoiceInputReturn {
  recording: boolean;
  micError: string | null;
  start: () => void;
  stop: () => void;
  supported: boolean;
}

export function useVoiceInput({ onTranscript, onStart }: UseVoiceInputOptions): UseVoiceInputReturn {
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  // Tracks whether onerror fired so onend doesn't double-reset
  const erroredRef = useRef(false);

  const SR = (window as Window & typeof globalThis & {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }).SpeechRecognition ?? (window as Window & typeof globalThis & {
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }).webkitSpeechRecognition;

  const supported = !!SR;

  const start = useCallback(() => {
    if (!SR) return;
    setMicError(null);
    erroredRef.current = false;
    onStart?.();                 // TTS-04: stop TTS before mic opens
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[e.results.length - 1][0].transcript;
      onTranscript(text);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      erroredRef.current = true;
      setRecording(false);
      if (e.error === 'not-allowed') {
        setMicError('Microphone permission denied. Allow access in your browser settings.');
      } else if (e.error === 'no-speech') {
        setMicError(null); // silent — just ended without hearing anything
      } else {
        setMicError(`Mic error: ${e.error}`);
      }
    };
    rec.onend = () => {
      if (!erroredRef.current) setRecording(false);
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }, [SR, onStart, onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  }, []);

  return { recording, micError, start, stop, supported };
}
