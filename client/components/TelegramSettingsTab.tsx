import { useState, useEffect, type FC } from 'react';

type TelegramUiState = {
  projectRootsText: string;
  allowedUserIdsText: string;
  maxSearchDepth: number;
  tokenConfigured: boolean;
  tokenSource: 'env' | 'file' | 'none';
};

export const TelegramSettingsTab: FC = () => {
  const [loading, setLoading] = useState(true);
  const [rootsText, setRootsText] = useState('');
  const [idsText, setIdsText] = useState('');
  const [depth, setDepth] = useState(8);
  const [tokenSource, setTokenSource] = useState<TelegramUiState['tokenSource']>('none');
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [tokenDraft, setTokenDraft] = useState('');
  const [busyConfig, setBusyConfig] = useState(false);
  const [busyToken, setBusyToken] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/telegram-settings');
      if (!r.ok) throw new Error(await r.text());
      const d = (await r.json()) as TelegramUiState;
      setRootsText(d.projectRootsText ?? '');
      setIdsText(d.allowedUserIdsText ?? '');
      setDepth(typeof d.maxSearchDepth === 'number' ? d.maxSearchDepth : 8);
      setTokenSource(d.tokenSource ?? 'none');
      setTokenConfigured(!!d.tokenConfigured);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function flashOk(msg: string) {
    setFeedback(msg);
    setError(null);
    window.setTimeout(() => setFeedback(null), 6000);
  }

  async function saveConfig() {
    setBusyConfig(true);
    setError(null);
    try {
      const r = await fetch('/api/telegram-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectRootsText: rootsText,
          allowedUserIdsText: idsText,
          maxSearchDepth: depth,
        }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(data.error ?? r.statusText);
      flashOk('Saved. Telegram bot restarted with new roots / allowlist.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyConfig(false);
    }
  }

  async function saveToken() {
    setBusyToken(true);
    setError(null);
    try {
      const r = await fetch('/api/telegram-token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: tokenDraft }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(data.error ?? r.statusText);
      setTokenDraft('');
      flashOk('Token saved to ~/.slop/telegram-secrets.json — bot restarted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyToken(false);
    }
  }

  async function clearToken() {
    setBusyToken(true);
    setError(null);
    try {
      const r = await fetch('/api/telegram-token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: '' }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(data.error ?? r.statusText);
      flashOk('Saved token removed from disk — bot restarted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyToken(false);
    }
  }

  async function restartOnly() {
    setBusyConfig(true);
    setError(null);
    try {
      const r = await fetch('/api/telegram-restart', { method: 'POST' });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(data.error ?? r.statusText);
      flashOk('Telegram bot restarted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyConfig(false);
    }
  }

  if (loading) {
    return <div className="settings-section-desc telegram-settings-loading">Loading Telegram settings…</div>;
  }

  return (
    <div className="settings-group telegram-settings-tab">
      {tokenSource === 'env' && (
        <div className="telegram-settings-banner telegram-settings-banner--info">
          <strong>Environment override:</strong> <code className="telegram-settings-code">TELEGRAM_BOT_TOKEN</code> is set.
          The server uses that token and ignores the saved file until the variable is unset. You can still edit roots and allowlist below.
        </div>
      )}

      {feedback && (
        <div className="telegram-settings-banner telegram-settings-banner--ok">
          {feedback}
        </div>
      )}
      {error && (
        <div className="telegram-settings-banner telegram-settings-banner--err">
          {error}
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-label">Bot token</div>
        <div className="settings-section-desc" style={{ marginBottom: 8 }}>
          From <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="telegram-settings-link">@BotFather</a>.
          Stored in <code className="telegram-settings-code">~/.slop/telegram-secrets.json</code> (mode 600). Never committed.
        </div>
        <div className="telegram-settings-token-row">
          <input
            className="settings-text-input telegram-settings-token-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={tokenSource === 'env' ? 'Token managed by environment' : 'Paste new token to replace saved token'}
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            disabled={tokenSource === 'env'}
          />
          <button
            type="button"
            className="fp-btn primary"
            onClick={() => void saveToken()}
            disabled={busyToken || tokenSource === 'env' || !tokenDraft.trim()}
          >
            Save token
          </button>
        </div>
        <div className="telegram-settings-token-actions">
          <button
            type="button"
            className="fp-btn"
            onClick={() => void clearToken()}
            disabled={busyToken || tokenSource === 'env' || !tokenConfigured}
          >
            Remove saved token
          </button>
          <span className="settings-section-desc" style={{ marginBottom: 0 }}>
            Status: {tokenConfigured ? (tokenSource === 'env' ? 'configured (env)' : 'configured (file)') : 'no token'}
          </span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Project roots</div>
        <div className="settings-section-desc" style={{ marginBottom: 8 }}>
          One absolute path per line (or <code className="telegram-settings-code">~/…</code>). Folder names under these roots must resolve uniquely for <code className="telegram-settings-code">PROJECT=name</code> in Telegram.
        </div>
        <textarea
          className="settings-textarea"
          rows={5}
          spellCheck={false}
          placeholder={'/Users/you/Projects\n/Users/you/work'}
          value={rootsText}
          onChange={(e) => setRootsText(e.target.value)}
        />
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Allowed Telegram user IDs</div>
        <div className="settings-section-desc" style={{ marginBottom: 8 }}>
          Comma-separated numeric IDs (private chats only). Use <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="telegram-settings-link">@userinfobot</a> to find yours. Empty list blocks everyone.
        </div>
        <input
          className="settings-text-input"
          type="text"
          spellCheck={false}
          placeholder="e.g. 123456789, 987654321"
          value={idsText}
          onChange={(e) => setIdsText(e.target.value)}
        />
      </div>

      <div className="settings-section settings-section--row telegram-settings-depth-row">
        <div className="settings-section-label">Search depth</div>
        <input
          className="settings-text-input telegram-settings-depth-input"
          type="number"
          min={0}
          max={32}
          value={depth}
          onChange={(e) => setDepth(Math.min(32, Math.max(0, Number(e.target.value) || 0)))}
        />
      </div>

      <div className="telegram-settings-actions">
        <button type="button" className="fp-btn primary" onClick={() => void saveConfig()} disabled={busyConfig}>
          {busyConfig ? 'Saving…' : 'Save roots & allowlist'}
        </button>
        <button type="button" className="fp-btn" onClick={() => void restartOnly()} disabled={busyConfig}>
          Restart bot only
        </button>
      </div>

      <div className="settings-info-card telegram-settings-help">
        <div className="settings-section-label" style={{ marginBottom: 6 }}>Using Telegram</div>
        <div className="settings-section-desc" style={{ marginBottom: 0, lineHeight: 1.65 }}>
          Start the server with this UI reachable (or run <code className="telegram-settings-code">npm run server</code>). Open your bot in Telegram (private chat), send{' '}
          <code className="telegram-settings-code">PROJECT=my_folder</code> then your message. Voice notes are transcribed with Whisper and sent as text; photos and documents are saved under{' '}
          <code className="telegram-settings-code">~/.slop/telegram-inbound/&lt;chat-id&gt;/</code> and referenced with <code className="telegram-settings-code">@absolutePath</code> for the agent. Agent command comes from Settings → Agent &amp; Tools (saved to{' '}
          <code className="telegram-settings-code">~/.slop/settings.json</code>). This tab does not share a PTY with browser sessions — Telegram uses its own persistent session per chat.
        </div>
      </div>
    </div>
  );
};
