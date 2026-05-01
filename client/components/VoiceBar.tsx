import type { FC } from 'react';
import { IconToggle, SpeakerOnIcon, SpeakerOffIcon } from './IconToggle';

interface VoiceBarProps {
  recording: boolean;
  transcribing?: boolean;
  speaking: boolean;
  ttsEnabled: boolean;
  micError?: string | null;
  onMicStart: () => void;
  onMicStop: () => void;
  onTtsToggle: () => void;
  onTtsStop: () => void;
  supported?: boolean;
  ttsAvailable?: boolean | null;
  whisperAvailable?: boolean | null;
  compact?: boolean;
}

export const VoiceBar: FC<VoiceBarProps> = ({
  recording,
  transcribing = false,
  speaking,
  ttsEnabled,
  micError,
  onMicStart,
  onMicStop,
  onTtsToggle,
  onTtsStop,
  supported = true,
  ttsAvailable = null,
  whisperAvailable = null,
  compact = false,
}) => {
  const ttsNotReady = ttsEnabled && ttsAvailable === false;
  const sttNotReady = whisperAvailable === false;

  const handleMicClick = () => {
    if (recording) onMicStop();
    else onMicStart();
  };

  if (compact) {
    const micTitle = recording ? 'Stop recording' : transcribing ? 'Transcribing…' : 'Record voice message';
    const micDisabled = transcribing || (!supported && !recording);
    const micClass = [
      'icon-btn',
      recording ? 'vb-compact-recording' : '',
      micDisabled ? 'icon-btn-disabled' : '',
    ].filter(Boolean).join(' ');

    return (
      <div className="voice-bar">
        <button
          type="button"
          className={micClass}
          title={micTitle}
          disabled={micDisabled}
          onClick={handleMicClick}
        >
          {recording ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </button>
        <IconToggle
          on={ttsEnabled}
          onIcon={<SpeakerOnIcon />}
          offIcon={<SpeakerOffIcon />}
          onTooltip="AI voice on — click to mute"
          offTooltip="AI voice off — click to enable"
          pulsing={speaking}
          onClick={onTtsToggle}
        />
      </div>
    );
  }

  return (
    <div className="voice-bar">
      <button
        type="button"
        className={[
          'vb-btn',
          recording ? 'vb-btn--recording' : '',
          transcribing ? 'vb-btn--transcribing' : '',
          (!supported && !recording) ? 'disabled' : '',
        ].filter(Boolean).join(' ')}
        title={recording ? 'Stop recording' : transcribing ? 'Transcribing…' : 'Record voice message'}
        disabled={transcribing || (!supported && !recording)}
        onClick={handleMicClick}
      >
        {recording ? (
          <>
            <span className="vb-rec-dot" />
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            Stop
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            {transcribing ? 'Transcribing…' : 'Record'}
          </>
        )}
      </button>

      <IconToggle
        on={ttsEnabled}
        onIcon={<SpeakerOnIcon />}
        offIcon={<SpeakerOffIcon />}
        onTooltip="AI voice on — click to mute"
        offTooltip="AI voice off — click to enable"
        pulsing={speaking}
        onClick={onTtsToggle}
      />

      {speaking && (
        <button
          type="button"
          className="vb-btn stop"
          title="Stop TTS"
          onClick={onTtsStop}
        >
          Stop
        </button>
      )}

      {speaking && (
        <span className="vb-speaking">Speaking…</span>
      )}

      {ttsNotReady && (
        <span className="vb-error" title="Run: pip install &quot;piper-tts[http]&quot; then download a voice model">
          Piper not ready — see console for setup instructions
        </span>
      )}

      {sttNotReady && (
        <span className="vb-error" title="Run: pip install openai-whisper &amp;&amp; brew install ffmpeg">
          Whisper not ready — see console for setup instructions
        </span>
      )}

      {micError && (
        <span className="vb-error">{micError}</span>
      )}
    </div>
  );
};
