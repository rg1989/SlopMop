import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// --- AudioContext mock (jsdom does not implement Web Audio API) ---
class MockAudioBufferSourceNode {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = vi.fn(() => { this.onended?.(); });
  stop = vi.fn();
}
class MockAudioContext {
  state = 'running';
  destination = {};
  createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
  decodeAudioData = vi.fn((_ab: ArrayBuffer) =>
    Promise.resolve({} as AudioBuffer)
  );
}
vi.stubGlobal('AudioContext', MockAudioContext);

// --- Web Speech API mocks (jsdom does not implement these) ---

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];
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
  constructor() { MockSpeechRecognition.instances.push(this); }
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

// --- EventSource mock (jsdom does not implement EventSource) ---
class MockEventSource {
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  close = vi.fn();
  constructor(url: string) { this.url = url; }
}
vi.stubGlobal('EventSource', MockEventSource);

// --- ResizeObserver mock (jsdom does not implement ResizeObserver) ---
class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) { this.callback = callback; }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  MockSpeechRecognition.instances = [];
  mockSpeechSynthesis.speaking = false;
  mockSpeechSynthesis.speak.mockClear();
  mockSpeechSynthesis.cancel.mockClear();
  mockSpeechSynthesis.getVoices.mockReturnValue([
    { name: 'Alex', lang: 'en-US', default: true, localService: true, voiceURI: 'Alex' } as SpeechSynthesisVoice,
  ]);
});

export { mockSpeechSynthesis, MockSpeechRecognition };
