import React, { useState, useRef } from 'react';
import { Send, Lock, Globe, Paperclip, Users, X, ChevronDown, ChevronUp } from 'lucide-react';
import { TicketsApi } from '../../api/tickets';

interface ReplyComposerProps {
  onSend: (
    body: string,
    isInternal: boolean,
    attachments?: string[],
    cc?: string[],
  ) => Promise<void>;
  isSending?: boolean;
  canWriteInternal?: boolean;
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  onSend,
  isSending = false,
  canWriteInternal = true,
}) => {
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      return true;
    }
    return false;
  });
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddCc = (emailToAdd: string) => {
    const trimmed = emailToAdd.trim().toLowerCase().replace(/,/g, '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmed && emailRegex.test(trimmed) && !ccList.includes(trimmed)) {
      setCcList([...ccList, trimmed]);
      setCcInput('');
    }
  };

  const handleCcKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      if (ccInput.trim()) {
        handleAddCc(ccInput);
      }
    } else if (e.key === 'Backspace' && !ccInput && ccList.length > 0) {
      setCcList(ccList.slice(0, -1));
    }
  };

  const removeCc = (emailToRemove: string) => {
    setCcList(ccList.filter((email) => email !== emailToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || isSending || isUploading) return;

    // Flush any pending text in ccInput
    const finalCcList = [...ccList];
    const pendingCc = ccInput.trim().toLowerCase().replace(/,/g, '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (pendingCc && emailRegex.test(pendingCc) && !finalCcList.includes(pendingCc)) {
      finalCcList.push(pendingCc);
    }

    await onSend(
      body,
      isInternal && canWriteInternal,
      uploadedFiles.map((f) => f.id),
      !isInternal && finalCcList.length > 0 ? finalCcList : undefined,
    );
    setBody('');
    setUploadedFiles([]);
    setCcList([]);
    setCcInput('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newFiles = [...uploadedFiles];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const result = await TicketsApi.uploadFile(file);
        newFiles.push({ id: result.id, name: result.originalFilename });
      }
      setUploadedFiles(newFiles);
    } catch (err: any) {
      alert(`Failed to upload file: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <form onSubmit={handleSubmit} className={`reply-composer-card ${isMinimized ? 'is-minimized' : ''}`}>
      <div
        className="composer-toolbar"
        style={{ cursor: isMinimized ? 'pointer' : 'default', userSelect: 'none' }}
        onClick={() => {
          if (isMinimized) setIsMinimized(false);
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {canWriteInternal ? (
            <div className="composer-mode-tabs">
              <button
                type="button"
                className={`composer-tab ${!isInternal ? 'active public' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsInternal(false);
                  if (isMinimized) setIsMinimized(false);
                }}
              >
                <Globe size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Public Reply
              </button>
              <button
                type="button"
                className={`composer-tab ${isInternal ? 'active internal' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsInternal(true);
                  if (isMinimized) setIsMinimized(false);
                }}
              >
                <Lock size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Internal Note
              </button>
            </div>
          ) : (
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Globe size={13} /> Public Reply
            </div>
          )}

          {isMinimized && body.trim().length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--primary)',
                backgroundColor: 'var(--primary-surface, rgba(37,99,235,0.1))',
                padding: '1px 8px',
                borderRadius: '10px',
                border: '1px solid var(--primary-border, rgba(37,99,235,0.2))',
              }}
            >
              Draft saved
            </span>
          )}
        </div>

        <div className="composer-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="composer-notice-text" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {isInternal && canWriteInternal
              ? '🔒 Visible to staff only'
              : ccList.length > 0
                ? `🌐 Customer + ${ccList.length} CC recipient${ccList.length > 1 ? 's' : ''} will be notified`
                : '🌐 Customer will be notified'}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            className="composer-collapse-btn"
            title={isMinimized ? 'Expand reply box' : 'Minimize reply box'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      <div className={`composer-body-collapsible ${isMinimized ? 'is-collapsed' : 'is-expanded'}`}>
        <div className="composer-body-collapsible-inner">
          {/* Gmail / Zoho Desk Style Integrated CC Bar for Public Replies */}
          {!isInternal && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '6px',
                padding: '6px 16px',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                fontSize: '12px',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', userSelect: 'none' }}>
                CC:
              </span>

              {ccList.map((email) => (
                <span
                  key={email}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--primary, #2563eb)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    borderRadius: '12px',
                    padding: '1px 8px',
                    fontSize: '11.5px',
                    fontWeight: 500,
                  }}
                >
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => removeCc(email)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--primary, #2563eb)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}

              <input
                type="email"
                placeholder={ccList.length === 0 ? 'Add CC email (press Enter or comma)...' : 'Add another CC...'}
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onKeyDown={handleCcKeyDown}
                onBlur={() => {
                  if (ccInput.trim()) handleAddCc(ccInput);
                }}
                style={{
                  flex: 1,
                  minWidth: '180px',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  padding: '2px 4px',
                }}
              />
            </div>
          )}

          {uploadedFiles.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface-elevated)',
              }}
            >
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    fontSize: '12px',
                  }}
                >
                  <span>📎 {file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '14px',
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="composer-textarea"
            placeholder={
              isInternal && canWriteInternal
                ? 'Write an internal note for teammates...'
                : 'Type your reply to the customer...'
            }
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
          />

          {body.trim().length === 0 && (
            <div
              style={{
                padding: '4px 16px 8px',
                fontSize: '11px',
                color: '#e11d48',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--bg-surface-elevated, #fff)',
              }}
            >
              <span>⚠️ Message text is required to submit a reply or note.</span>
            </div>
          )}

          <div className="composer-footer">
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <Paperclip size={14} />
                <span>{isUploading ? 'Uploading...' : 'Attach File'}</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                style={{ display: 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={isSending || isUploading || !body.trim()}
              className={`btn ${isInternal && canWriteInternal ? 'btn-secondary' : 'btn-primary'}`}
              style={{
                ...(isInternal && canWriteInternal
                  ? { backgroundColor: '#f59e0b', color: '#000000', fontWeight: 600 }
                  : {}),
                ...(isSending || isUploading || !body.trim()
                  ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }
                  : { cursor: 'pointer' }),
              }}
            >
              <Send size={14} />
              <span>
                {isSending
                  ? 'Sending...'
                  : isInternal && canWriteInternal
                    ? 'Save Internal Note'
                    : 'Send Public Reply'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
