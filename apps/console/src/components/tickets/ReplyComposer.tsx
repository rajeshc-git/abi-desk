import React, { useState, useRef } from 'react';
import { Send, Lock, Globe, Paperclip } from 'lucide-react';
import { TicketsApi } from '../../api/tickets';

interface ReplyComposerProps {
  onSend: (body: string, isInternal: boolean, attachments?: string[]) => Promise<void>;
  isSending?: boolean;
  canWriteInternal?: boolean;
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  onSend,
  isSending = false,
  canWriteInternal = true,
}) => {
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || isSending || isUploading) return;

    await onSend(
      body,
      isInternal && canWriteInternal,
      uploadedFiles.map((f) => f.id),
    );
    setBody('');
    setUploadedFiles([]);
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
    <form onSubmit={handleSubmit} className="reply-composer-card">
      <div className="composer-toolbar">
        {canWriteInternal ? (
          <div className="composer-mode-tabs">
            <button
              type="button"
              className={`composer-tab ${!isInternal ? 'active public' : ''}`}
              onClick={() => setIsInternal(false)}
            >
              <Globe size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Public Reply
            </button>
            <button
              type="button"
              className={`composer-tab ${isInternal ? 'active internal' : ''}`}
              onClick={() => setIsInternal(true)}
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

        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {isInternal && canWriteInternal
            ? '🔒 Visible to staff only'
            : '🌐 Customer will be notified'}
        </div>
      </div>

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
        required
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
    </form>
  );
};
