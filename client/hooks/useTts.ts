import { useState, useRef, useCallback, useEffect } from 'react';

// Comprehensive ANSI / VT100 escape sequence stripping for TTS
function stripAnsi(raw: string): string {
  return raw
    // CSI sequences: ESC [ <param bytes 0x30-0x3F> <intermediate bytes 0x20-0x2F> <final byte 0x40-0x7E>
    // This correctly handles DEC private sequences like \x1b[?2026h, \x1b[?1049h, etc.
    // (the old regex [0-9;]* missed '?' causing "2026 h" to leak through as readable text)
    .replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, '')
    // OSC sequences: ESC ] ... BEL or ST (ESC \)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // DCS / PM / APC / SOS sequences: ESC [P^_] ... ST
    .replace(/\x1b[P^_][^\x1b]*(?:\x1b\\)?/g, '')
    // Remaining 2-char ESC sequences (Fp, Fe, Fs codes)
    .replace(/\x1b[\x20-\x7e]/g, '')
    // Bare ESC (e.g. at chunk boundary where sequence was split)
    .replace(/\x1b/g, '')
    // Carriage-return overwrites: \r + content until newline = spinner / status bar lines
    // "\rWorking..." is a line overwrite — not visible text the user should hear
    .replace(/\r[^\n]*/g, '')
    // Non-printable control chars (keep \t=0x09, \n=0x0A)
    .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, '');
}

// Strip markdown/HTML so Piper reads clean prose, not symbols
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')           // fenced code blocks
    .replace(/`[^`\n]+`/g, '')                // inline code
    .replace(/<[^>]+>/g, '')                   // HTML tags
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')   // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // links → label text
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1') // bold/italic
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, '$1') // underscore bold/italic
    .replace(/^[\s]*[-*+]\s+/gm, '')          // unordered list bullets
    .replace(/^[\s]*\d+\.\s+/gm, '')          // ordered list numbers
    .replace(/^>\s*/gm, '')                   // blockquotes
    .replace(/^[-*_]{3,}$/gm, '')             // horizontal rules
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Split buffer at sentence boundaries; speak complete sentences; return remainder.
function flushSentences(buffer: string, speak: (s: string) => void): string {
  const parts = buffer.split(/([.!?])(?=\s|$)/);
  let i = 0;
  while (i + 1 < parts.length) {
    const sentence = (parts[i] + (parts[i + 1] ?? '')).trim();
    if (sentence) speak(sentence);
    i += 2;
  }
  return parts[parts.length - 1] ?? '';
}

interface UseTtsOptions {
  enabled: boolean;
}

interface UseTtsReturn {
  speaking: boolean;
  stop: () => void;
  handleData: (raw: string) => void;
  piperAvailable: boolean | null;
}

export function useTts({ enabled }: UseTtsOptions): UseTtsReturn {
  const [speaking, setSpeaking] = useState(false);
  const [piperAvailable, setPiperAvailable] = useState<boolean | null>(null);

  const bufferRef  = useRef('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef  = useRef<AudioBufferSourceNode | null>(null);
  const queueRef   = useRef<string[]>([]);
  const playingRef = useRef(false);
  const abortRef   = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);

  // Check whether Piper is available on mount
  useEffect(() => {
    fetch('/api/tts/status')
      .then(r => r.json())
      .then((d: { available: boolean }) => setPiperAvailable(d.available))
      .catch(() => setPiperAvailable(false));
  }, []);

  const getCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  // Plays the next queued sentence via Piper; recurses when done
  const playNext = useCallback(async () => {
    if (playingRef.current || queueRef.current.length === 0) return;

    const text = queueRef.current.shift()!;
    playingRef.current = true;
    stoppedRef.current = false;
    setSpeaking(true);

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: ctrl.signal,
      });

      if (!res.ok || stoppedRef.current) throw new Error('skip');

      const ab = await res.arrayBuffer();
      if (stoppedRef.current) throw new Error('skip');

      const ctx = getCtx();
      const audioBuffer = await ctx.decodeAudioData(ab);
      if (stoppedRef.current) throw new Error('skip');

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      sourceRef.current = source;

      await new Promise<void>(resolve => {
        source.onended = () => resolve();
        source.start();
      });
    } catch {
      // Fetch aborted or stop() called — fall through to cleanup
    }

    sourceRef.current = null;
    abortRef.current = null;
    playingRef.current = false;

    if (!stoppedRef.current && queueRef.current.length > 0) {
      playNext();
    } else {
      setSpeaking(false);
    }
  }, [getCtx]);

  const speak = useCallback((text: string) => {
    if (!text.trim()) return;
    queueRef.current.push(text);
    playNext();
  }, [playNext]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    queueRef.current = [];
    bufferRef.current = '';
    abortRef.current?.abort();
    abortRef.current = null;
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }
    playingRef.current = false;
    setSpeaking(false);
  }, []);

  const handleData = useCallback((raw: string) => {
    if (!enabled) return;
    const text = stripMarkdown(stripAnsi(raw));
    bufferRef.current += text;
    bufferRef.current = flushSentences(bufferRef.current, speak);
  }, [enabled, speak]);

  return { speaking, stop, handleData, piperAvailable };
}
