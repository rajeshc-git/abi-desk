import React, { useState } from 'react';
import { Monitor, Terminal, Wifi, AlertOctagon, Copy, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export interface DiagnosticsData {
  userAgent?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  deviceType?: string;
  screenWidth?: number;
  screenHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  pageUrl?: string;
  pageTitle?: string;
  referrer?: string;
  consoleLogs?: Array<{ level: string; timestamp: string; args: string[] }>;
  networkLogs?: Array<{
    method: string;
    url: string;
    status: number;
    durationMs: number;
    error?: string;
    timestamp: string;
  }>;
  errors?: Array<{ message: string; stack?: string; timestamp: string }>;
}

interface DiagnosticsViewProps {
  diagnostics?: DiagnosticsData | null;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ diagnostics }) => {
  const [activeTab, setActiveTab] = useState<'device' | 'console' | 'network' | 'errors'>('device');
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  if (!diagnostics) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No client telemetry or diagnostics bundle attached to this ticket.
      </div>
    );
  }

  const handleCopyJson = async () => {
    const text = JSON.stringify(diagnostics, null, 2);
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (err) {
      console.error('Navigator clipboard failed, falling back', err);
    }

    if (!success) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          success = true;
        }
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Diagnostics telemetry copied to clipboard!');
    } else {
      toast.error('Failed to copy diagnostics');
    }
  };

  const consoleLogs = diagnostics.consoleLogs || [];
  const networkLogs = diagnostics.networkLogs || [];
  const errors = diagnostics.errors || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('device')}
            className={`btn btn-sm ${activeTab === 'device' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Monitor size={14} /> Device & OS
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className={`btn btn-sm ${activeTab === 'console' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Terminal size={14} /> Console Logs ({consoleLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`btn btn-sm ${activeTab === 'network' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Wifi size={14} /> Network ({networkLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`btn btn-sm ${activeTab === 'errors' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <AlertOctagon size={14} /> JS Errors ({errors.length})
          </button>
        </div>

        <button onClick={handleCopyJson} className="btn btn-secondary btn-sm">
          {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy All'}</span>
        </button>
      </div>

      {activeTab === 'device' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div className="card">
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '12px',
              }}
            >
              BROWSER & PLATFORM
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div>
                <strong>Browser:</strong> {diagnostics.browserName} {diagnostics.browserVersion}
              </div>
              <div>
                <strong>Operating System:</strong> {diagnostics.osName} {diagnostics.osVersion}
              </div>
              <div>
                <strong>Device Type:</strong> {diagnostics.deviceType || 'Desktop'}
              </div>
              <div>
                <strong>Pixel Ratio:</strong> {diagnostics.devicePixelRatio || 1}x
              </div>
            </div>
          </div>

          <div className="card">
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '12px',
              }}
            >
              DISPLAY & SESSION
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div>
                <strong>Screen Resolution:</strong> {diagnostics.screenWidth} ×{' '}
                {diagnostics.screenHeight}
              </div>
              <div>
                <strong>Viewport Size:</strong> {diagnostics.viewportWidth} ×{' '}
                {diagnostics.viewportHeight}
              </div>
              <div style={{ wordBreak: 'break-all' }}>
                <strong>URL:</strong> {diagnostics.pageUrl || 'N/A'}
              </div>
              <div style={{ wordBreak: 'break-all' }}>
                <strong>Referrer:</strong> {diagnostics.referrer || 'None'}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'console' && (
        <div className="diagnostics-terminal">
          {consoleLogs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No console traces captured.</div>
          ) : (
            consoleLogs.map((log, i) => (
              <div key={i} className={`log-row ${log.level}`}>
                <span style={{ opacity: 0.5 }}>[{log.timestamp.slice(11, 19)}]</span>
                <span style={{ fontWeight: 700, textTransform: 'uppercase', width: '48px' }}>
                  {log.level}:
                </span>
                <span>{log.args.join(' ')}</span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'network' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
              >
                <th style={{ padding: '10px 14px' }}>Method</th>
                <th style={{ padding: '10px 14px' }}>Endpoint</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {networkLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    No network events recorded.
                  </td>
                </tr>
              ) : (
                networkLogs.map((req, i) => {
                  const isSuccess = req.status >= 200 && req.status < 300;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td
                        style={{
                          padding: '8px 14px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {req.method}
                      </td>
                      <td
                        style={{
                          padding: '8px 14px',
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {req.url}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ color: isSuccess ? '#34d399' : '#f87171', fontWeight: 600 }}>
                          {req.status || 'ERR'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>
                        {req.durationMs}ms
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'errors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {errors.length === 0 ? (
            <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
              No uncaught JavaScript errors recorded.
            </div>
          ) : (
            errors.map((err, i) => (
              <div
                key={i}
                className="card"
                style={{
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#f87171',
                    fontWeight: 700,
                    marginBottom: '8px',
                  }}
                >
                  <AlertOctagon size={16} />
                  <span>{err.message}</span>
                </div>
                {err.stack && (
                  <pre
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {err.stack}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
