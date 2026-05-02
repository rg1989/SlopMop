import { describe, it, expect } from 'vitest';
import { chunkTextForTelegram } from '../server/telegram-chunk.js';

describe('chunkTextForTelegram', () => {
  it('returns empty for empty input', () => {
    expect(chunkTextForTelegram('', 100)).toEqual([]);
  });

  it('single chunk when under max', () => {
    expect(chunkTextForTelegram('hello', 100)).toEqual(['hello']);
  });

  it('keeps exact-length single chunk', () => {
    expect(chunkTextForTelegram('abcdefghij', 10)).toEqual(['abcdefghij']);
  });

  it('splits long unbroken runs and rejoins losslessly', () => {
    const word = 'x'.repeat(50);
    const parts = chunkTextForTelegram(word, 20);
    expect(parts.join('')).toBe(word);
    parts.forEach((p) => expect(p.length).toBeLessThanOrEqual(20));
  });

  it('prefers breaking before second line when possible', () => {
    const max = 15;
    const text = `hello world\n${'z'.repeat(30)}`;
    const parts = chunkTextForTelegram(text, max);
    expect(parts[0]).toContain('hello');
    expect(parts[0]).not.toMatch(/z{4,}/);
    parts.forEach((p) => expect(p.length).toBeLessThanOrEqual(max));
  });
});
