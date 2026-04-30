import type { FC } from 'react';

interface VoiceBarProps {
  recording: boolean;
  speaking: boolean;
  ttsEnabled: boolean;
  micError?: string | null;
  onMicStart: () => void;
  onMicStop: () => void;
  onTtsToggle: () => void;
  onTtsStop: () => void;
  supported?: boolean;  // false = mic not available (Firefox)
}

export const VoiceBar: FC<VoiceBarProps> = ({
  recording,
  speaking,
  ttsEnabled,
  micError,
  onMicStart,
  onMicStop,
  onTtsToggle,
  onTtsStop,
  supported = true,
}) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      borderTop: '1px solid #30363d',
      background: '#161b22',
    }}>
      {/* Mic button — VOICE-01, VOICE-02 */}
      <button
        type="button"
        title={recording ? 'Stop recording' : 'Record voice message'}
        disabled={!supported}
        onClick={recording ? onMicStop : onMicStart}
        style={{
          background: recording ? '#d4845a22' : 'none',
          border: recording ? '1px solid #d4845a' : '1px solid #30363d',
          borderRadius: '4px',
          padding: '4px 8px',
          cursor: supported ? 'pointer' : 'not-allowed',
          color: supported ? (recording ? '#d4845a' : '#8b949e') : '#484f58',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {/* Microphone SVG */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        {recording ? 'Recording…' : 'Voice'}
      </button>

      {/* TTS toggle — TTS-01 */}
      <button
        type="button"
        title={ttsEnabled ? 'Disable TTS' : 'Enable TTS'}
        onClick={onTtsToggle}
        style={{
          background: ttsEnabled ? '#388bfd22' : 'none',
          border: ttsEnabled ? '1px solid #388bfd' : '1px solid #30363d',
          borderRadius: '4px',
          padding: '4px 8px',
          cursor: 'pointer',
          color: ttsEnabled ? '#388bfd' : '#8b949e',
          fontSize: '13px',
        }}
      >
        TTS
      </button>

      {/* Stop TTS button — TTS-02, only visible when speaking */}
      {speaking && (
        <button
          type="button"
          title="Stop TTS"
          onClick={onTtsStop}
          style={{
            background: 'none',
            border: '1px solid #f85149',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            color: '#f85149',
            fontSize: '13px',
          }}
        >
          Stop
        </button>
      )}

      {/* Speaking indicator */}
      {speaking && (
        <span style={{ color: '#388bfd', fontSize: '12px', fontStyle: 'italic' }}>
          Speaking…
        </span>
      )}

      {/* Mic error */}
      {micError && (
        <span style={{ color: '#f85149', fontSize: '12px' }}>
          {micError}
        </span>
      )}
    </div>
  );
};
