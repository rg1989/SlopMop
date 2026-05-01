import { useTts } from './useTts';
import { useVoiceInput } from './useVoiceInput';

// App-scoped: audio is shared across sessions — only one source should speak
// or listen at a time. This coordinator enforces mutual exclusion between TTS
// and voice input so neither hook needs to know about the other.
//
// The rule: when voice input starts, any in-progress TTS is stopped.
// Both hooks remain independently accessible so the UI can read their state.

interface UseAudioCoordinatorOptions {
  ttsEnabled: boolean;
  onTranscript: (text: string) => void;
}

export interface UseAudioCoordinatorReturn {
  tts: ReturnType<typeof useTts>;
  voice: ReturnType<typeof useVoiceInput>;
}

export function useAudioCoordinator({
  ttsEnabled,
  onTranscript,
}: UseAudioCoordinatorOptions): UseAudioCoordinatorReturn {
  const tts = useTts({ enabled: ttsEnabled });

  const voice = useVoiceInput({
    onTranscript,
    onStart: () => tts.stop(), // mutual exclusion: mic start always stops TTS
  });

  return { tts, voice };
}
