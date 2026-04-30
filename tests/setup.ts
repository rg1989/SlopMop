import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// --- Web Speech API mocks (jsdom does not implement these) ---

class MockSpeechRecognition {
  lang = 'en-US';
  interimResults = false;
  continuous = false;
  onresult: ((e: SpeechRecognitionEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null = null;
  onstart: (() => void) | null = null;
  start = vi.fn(() => { this.onstart?.(); });
  stop = vi.fn(() => { this.onend?.(); });
  abort = vi.fn();
}

const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  speaking: false,
  pending: false,
  paused: false,
  getVoices: vi.fn(() => [
    { name: 'Alex', lang: 'en-US', default: true, localService: true, voiceURI: 'Alex' } as SpeechSynthesisVoice,
  ]),
  onvoiceschanged: null as (() => void) | null,
};

vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition);
vi.stubGlobal('speechSynthesis', mockSpeechSynthesis);
vi.stubGlobal('SpeechSynthesisUtterance', class {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  lang = 'en-US';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  constructor(text: string) { this.text = text; }
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  mockSpeechSynthesis.speaking = false;
  mockSpeechSynthesis.speak.mockClear();
  mockSpeechSynthesis.cancel.mockClear();
  mockSpeechSynthesis.getVoices.mockReturnValue([
    { name: 'Alex', lang: 'en-US', default: true, localService: true, voiceURI: 'Alex' } as SpeechSynthesisVoice,
  ]);
});

export { mockSpeechSynthesis, MockSpeechRecognition };
