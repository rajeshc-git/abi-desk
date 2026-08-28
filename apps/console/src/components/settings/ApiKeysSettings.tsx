import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const ApiKeysSettings: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isKeyOpen, setIsKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const toast = useToast();

  const loadApiKeys = async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.get('/admin/api-keys');
      setApiKeys(res || []);
    } catch (err: any) {
      toast.error(`Failed to load API keys: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const copyTextToClipboard = async (text: string, onSuccess: () => void, toastMsg: string) => {
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
      onSuccess();
      toast.success(toastMsg);
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopyKey = () => {
    if (createdRawKey) {
      copyTextToClipboard(
        createdRawKey,
        () => {
          setCopiedKey(true);
          setTimeout(() => setCopiedKey(false), 2000);
        },
        'API key copied to clipboard!',
      );
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await ApiClient.post('/admin/api-keys', {
        name: keyName,
        scopes: ['ticket:create', 'ticket:read:tenant', 'ticket:update:tenant'],
      });
      setCreatedRawKey(res.secretKey);
      loadApiKeys();
      toast.success('API Key created successfully!');
    } catch (err: any) {
      toast.error(`API Key error: ${err.message}`);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
    try {
      await ApiClient.delete(`/admin/api-keys/${id}`);
      loadApiKeys();
      toast.success('API Key revoked successfully!');
    } catch (err: any) {
      toast.error(`Error revoking key: ${err.message}`);
    }
  };

  const safeFormatDate = (dateVal: any) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <LoadingSpinner size={24} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Server API Keys</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Manage server credentials for programmatic access and external integrations.
          </p>
        </div>
        <button
          onClick={() => {
            setCreatedRawKey(null);
            setIsKeyOpen(true);
          }}
          className="btn btn-primary btn-sm"
        >
          <Plus size={14} /> Generate API Key
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {apiKeys.length === 0 ? (
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '24px 0',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            No API keys configured yet. Click Generate API Key to create one.
          </div>
        ) : (
          apiKeys.map((k) => (
            <div
              key={k.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{k.name}</div>
                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                  }}
                >
                  Key: {k.prefix}... | Uses: {k.useCount?.toString() || '0'} | Created:{' '}
                  {safeFormatDate(k.createdAt)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {k.revokedAt ? (
                  <span className="badge badge-closed">Revoked</span>
                ) : (
                  <>
                    <span className="badge badge-open">Active</span>
                    <button
                      onClick={() => handleRevokeApiKey(k.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={12} /> Revoke
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Generate API Key Modal */}
      <Modal
        isOpen={isKeyOpen}
        onClose={() => {
          setIsKeyOpen(false);
          setCreatedRawKey(null);
          setKeyName('');
        }}
        title="Generate Server API Key"
      >
        {createdRawKey ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: '1.5',
              }}
            >
              Please save this secret key somewhere safe. For security reasons,{' '}
              <strong>you will not be able to view it again</strong> through the settings panel. If you
              lose this key, you will need to revoke it and create a new one.
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                Key Name / Description
              </label>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {keyName}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                Secret Key
              </label>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={createdRawKey}
                  style={{
                    width: '100%',
                    padding: '12px 48px 12px 16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'text',
                  }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: copiedKey ? '#10b981' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!copiedKey) e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!copiedKey) e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                  title="Copy to clipboard"
                >
                  {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={() => {
                  setIsKeyOpen(false);
                  setCreatedRawKey(null);
                  setKeyName('');
                }}
                className="btn btn-primary"
                style={{ padding: '8px 24px', fontSize: '13px', fontWeight: 600 }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleCreateApiKey}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Key Description / Name
              </label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. CI Integration Key"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                required
              />
            </div>
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsKeyOpen(false);
                  setCreatedRawKey(null);
                  setKeyName('');
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Generate Key
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
