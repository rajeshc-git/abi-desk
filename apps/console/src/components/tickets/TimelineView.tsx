import React from 'react';
import {
  Lock,
  Globe,
  FileText,
  CheckCircle,
  ArrowUpRight,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Eye,
  Download,
  ExternalLink,
  X,
  Paperclip,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
} from 'lucide-react';
import { ApiClient } from '../../api/client';
import { FormattedEmailContent } from '../common/FormattedEmailContent';
import { getMediaType } from '../media/MediaPlayer';

export interface CommentItem {
  id: string;
  body: string;
  isInternal?: boolean;
  visibility?: 'INTERNAL' | 'PUBLIC' | string;
  author?: { fullName: string; email: string; kind?: string };
  createdAt: string;
  attachments?: Array<{ id: string; originalFilename: string; mimeType: string; sizeBytes?: number }>;
}

export interface ActivityItem {
  id: string;
  action: string;
  actor?: { fullName: string };
  details?: Record<string, any>;
  createdAt: string;
}

interface TimelineViewProps {
  comments: CommentItem[];
  activities?: ActivityItem[];
  initialTicket?: {
    description?: string;
    requester?: { fullName: string; email?: string };
    createdAt?: string;
    channel?: string;
    mediaAssets?: Array<{ id: string; originalFilename?: string | null; mimeType?: string | null; sizeBytes?: number }>;
  };
}

const urlCache = new Map<string, { url: string; expiresAt: number }>();

const AttachmentItem: React.FC<{
  att: { id: string; originalFilename?: string | null; mimeType?: string | null; sizeBytes?: number };
}> = ({ att }) => {
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);

  const typeInfo = getMediaType({
    filename: att.originalFilename,
    mimeType: att.mimeType || undefined,
  });

  const displayName = att.originalFilename?.trim() || 'Attachment';
  const sizeStr = att.sizeBytes ? `${Math.max(1, Math.round(att.sizeBytes / 1024))} KB` : '';

  const loadMediaUrl = React.useCallback(async (): Promise<string | null> => {
    const cached = urlCache.get(att.id);
    if (cached && cached.expiresAt > Date.now()) {
      setDownloadUrl(cached.url);
      return cached.url;
    }

    setLoading(true);
    try {
      const res = await ApiClient.post<{ url: string }>(`/media/${att.id}/download`, {
        disposition: 'inline',
      });
      urlCache.set(att.id, {
        url: res.url,
        expiresAt: Date.now() + 9 * 60 * 1000,
      });
      setDownloadUrl(res.url);
      return res.url;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [att.id]);

  // Pre-load image thumbnail URL
  React.useEffect(() => {
    if (typeInfo.isImage && !downloadUrl) {
      loadMediaUrl();
    }
  }, [typeInfo.isImage, downloadUrl, loadMediaUrl]);

  const handleOpenPreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = await loadMediaUrl();
    if (url) {
      setLightboxOpen(true);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await ApiClient.post<{ url: string }>(`/media/${att.id}/download`, {
        disposition: 'attachment',
      });
      const a = document.createElement('a');
      a.href = res.url;
      a.download = displayName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <>
      {/* Gmail-Style Visual Attachment Card */}
      <div
        onClick={handleOpenPreview}
        style={{
          width: '180px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-medium, #e2e8f0)',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-medium, #e2e8f0)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
        }}
        title={`Click to preview ${displayName}`}
      >
        {/* Top Preview Canvas */}
        <div
          style={{
            height: '95px',
            backgroundColor: 'var(--bg-app, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          }}
        >
          {typeInfo.isImage ? (
            downloadUrl ? (
              <img
                src={downloadUrl}
                alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <ImageIcon size={22} color="#0284c7" />
                <span>{loading ? 'Loading...' : 'Photo'}</span>
              </div>
            )
          ) : typeInfo.isPdf ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={18} color="#dc2626" />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>PDF Document</span>
            </div>
          ) : typeInfo.isVideo ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  backgroundColor: '#f3e8ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <VideoIcon size={18} color="#9333ea" />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Video</span>
            </div>
          ) : typeInfo.isAudio ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Music size={18} color="#d97706" />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Audio</span>
            </div>
          ) : typeInfo.isSheet ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  backgroundColor: '#d1fae5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileSpreadsheet size={18} color="#059669" />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Spreadsheet</span>
            </div>
          ) : typeInfo.isArchive ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  backgroundColor: '#ede9fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileArchive size={18} color="#8b5cf6" />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Archive</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  backgroundColor: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Paperclip size={18} color="#475569" />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Attachment</span>
            </div>
          )}
        </div>

        {/* Bottom Footer Info + Action Buttons */}
        <div
          style={{
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            gap: '4px',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={displayName}
            >
              {displayName}
            </div>
            {sizeStr && (
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {sizeStr}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleOpenPreview}
              style={{
                padding: '3px 5px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-hover, #f1f5f9)',
                color: 'var(--primary, #2563eb)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Preview"
            >
              <Eye size={11} />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              style={{
                padding: '3px 5px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-hover, #f1f5f9)',
                color: 'var(--text-secondary, #64748b)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Download"
            >
              <Download size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal with Full-Screen In-App Viewer */}
      {lightboxOpen && downloadUrl && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 100000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              width: typeInfo.isPdf ? '1050px' : typeInfo.isAudio ? '580px' : undefined,
              maxWidth: '92vw',
              maxHeight: '92vh',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: '14px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                gap: '16px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                {typeInfo.isImage ? (
                  <ImageIcon size={18} color="#0284c7" />
                ) : typeInfo.isPdf ? (
                  <FileText size={18} color="#ef4444" />
                ) : typeInfo.isVideo ? (
                  <VideoIcon size={18} color="#9333ea" />
                ) : typeInfo.isAudio ? (
                  <Music size={18} color="#d97706" />
                ) : typeInfo.isSheet ? (
                  <FileSpreadsheet size={18} color="#059669" />
                ) : typeInfo.isArchive ? (
                  <FileArchive size={18} color="#8b5cf6" />
                ) : (
                  <Paperclip size={18} color="#64748b" />
                )}
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
                {sizeStr ? (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#475569' }}>
                    {sizeStr}
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '6px 12px' }}
                >
                  <ExternalLink size={13} />
                  <span className="preview-action-text-full">Open in Tab</span>
                  <span className="preview-action-text-short">Open</span>
                </a>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                >
                  <Download size={13} /> Download
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '6px',
                  }}
                  title="Close (Esc)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: typeInfo.isPdf ? 0 : '24px',
                backgroundColor: '#f1f5f9',
                maxHeight: 'calc(92vh - 65px)',
              }}
            >
              {typeInfo.isImage ? (
                <img
                  src={downloadUrl}
                  alt={displayName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(90vh - 120px)',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    backgroundColor: '#ffffff',
                  }}
                />
              ) : typeInfo.isPdf ? (
                <object
                  data={`${downloadUrl}#toolbar=1`}
                  type="application/pdf"
                  style={{
                    width: '100%',
                    height: '80vh',
                    border: 'none',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {/* Fallback if browser blocks inline object */}
                  <div
                    style={{
                      height: '100%',
                      minHeight: '340px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 24px',
                      textAlign: 'center',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px',
                      }}
                    >
                      <FileText size={32} color="#ef4444" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                      {displayName}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', marginBottom: '20px', lineHeight: 1.5 }}>
                      Your browser's built-in PDF viewer is ready. Click below to view the full document in a clean tab or download it directly.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', fontSize: '13px' }}
                      >
                        <ExternalLink size={14} />
                        <span className="preview-action-text-full">Open in New Tab</span>
                        <span className="preview-action-text-short">Open</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', fontSize: '13px' }}
                      >
                        <Download size={14} /> Download PDF
                      </button>
                    </div>
                  </div>
                </object>
              ) : typeInfo.isVideo ? (
                <video
                  src={downloadUrl}
                  controls
                  autoPlay
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(90vh - 120px)',
                    borderRadius: '8px',
                    backgroundColor: '#000000',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                  }}
                />
              ) : typeInfo.isAudio ? (
                <div
                  style={{
                    padding: '36px 40px',
                    width: '100%',
                    maxWidth: '500px',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: '#fffbeb',
                      border: '2px solid #fef3c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#d97706',
                    }}
                  >
                    <Music size={32} />
                  </div>
                  <div>
                    <h4 style={{ color: '#0f172a', marginBottom: '4px', fontSize: '16px', fontWeight: 700 }}>
                      {displayName}
                    </h4>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Audio • {sizeStr}
                    </span>
                  </div>
                  <div style={{ width: '100%', marginTop: '4px' }}>
                    <audio controls autoPlay src={downloadUrl} style={{ width: '100%' }} />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 24px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    width: '100%',
                    maxWidth: '500px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <File size={56} style={{ margin: '0 auto 16px', color: '#64748b' }} />
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    {displayName}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                    This file format can be downloaded and opened with your system viewer.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
                    >
                      <ExternalLink size={14} />
                      <span className="preview-action-text-full">Open in New Tab</span>
                      <span className="preview-action-text-short">Open</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="btn btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px' }}
                    >
                      <Download size={15} />
                      <span>Download File ({sizeStr})</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const TimelineView: React.FC<TimelineViewProps> = ({ comments, initialTicket }) => {
  return (
    <div className="timeline-list">
      {/* Root/Opening Ticket Message (Zoho Desk / Zendesk Lead Message) */}
      {initialTicket?.description && (
        <div key="initial-ticket-description" className="timeline-item">
          <div
            className="user-avatar"
            style={{
              width: '32px',
              height: '32px',
              fontSize: '11px',
              backgroundColor: 'var(--primary, #2563eb)',
              color: '#ffffff',
            }}
          >
            {(initialTicket.requester?.fullName || 'Requester').slice(0, 2).toUpperCase()}
          </div>

          <div className="timeline-card" style={{ borderLeft: '3px solid var(--primary, #2563eb)' }}>
            <div className="timeline-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="author-name">
                  {initialTicket.requester?.fullName || 'Requester'}
                </span>
              </div>
              <span className="timestamp">
                {initialTicket.createdAt
                  ? new Date(initialTicket.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </span>
            </div>

            <div className="timeline-body">
              <FormattedEmailContent text={initialTicket.description} />
            </div>

            {initialTicket.mediaAssets && initialTicket.mediaAssets.length > 0 && (
              <div
                style={{
                  marginTop: '12px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                {initialTicket.mediaAssets.map((att) => (
                  <AttachmentItem key={att.id} att={att} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {comments.map((comment) => {
        const isInternal = comment.isInternal === true || comment.visibility === 'INTERNAL';
        const authorName = comment.author?.fullName || 'Support User';
        const formattedDate = new Date(comment.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const isTranscript =
          comment.body.includes('### Chat Transcript') ||
          comment.body.includes('Chat Transcript (');

        const renderTranscript = () => {
          const codeBlockMatch = comment.body.match(/```([\s\S]*?)```/);
          const rawLines =
            codeBlockMatch && codeBlockMatch[1] ? codeBlockMatch[1].trim().split('\n') : [];

          const messages: Array<{ time: string; author: string; text: string; isSystem: boolean }> =
            [];
          for (const line of rawLines) {
            const match = line.match(/^\[([^\]]+)\]\s*(.+?):\s*(.*)$/);
            if (match && match[1] && match[2]) {
              const isSystem = match[2].trim() === 'System';
              messages.push({
                time: match[1],
                author: match[2].trim(),
                text: (match[3] || '').trim(),
                isSystem,
              });
            }
          }

          if (messages.length === 0) {
            return <div style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</div>;
          }

          const customerName = messages.find((m) => !m.isSystem)?.author || '';

          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: 'var(--radius-md, 8px)',
                marginTop: '8px',
              }}
            >
              {messages.map((msg, index) => {
                if (msg.isSystem) {
                  return (
                    <div
                      key={index}
                      style={{
                        textAlign: 'center',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        margin: '4px 0',
                        fontStyle: 'italic',
                      }}
                    >
                      {msg.text}
                    </div>
                  );
                }

                const isCustomer = msg.author === customerName;
                const initials = msg.author.slice(0, 2).toUpperCase();
                const formattedTime = new Date(msg.time).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isCustomer ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-end',
                        flexDirection: isCustomer ? 'row-reverse' : 'row',
                      }}
                    >
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: isCustomer
                            ? 'var(--primary, #2563eb)'
                            : 'var(--bg-surface, #e2e8f0)',
                          border: isCustomer ? 'none' : '1px solid var(--border-medium)',
                          color: isCustomer ? '#ffffff' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '9px',
                          fontWeight: 700,
                        }}
                      >
                        {initials}
                      </div>
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: isCustomer ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                          backgroundColor: isCustomer
                            ? 'var(--primary, #2563eb)'
                            : 'var(--bg-surface, #ffffff)',
                          border: isCustomer ? 'none' : '1px solid var(--border-subtle, #e2e8f0)',
                          color: isCustomer ? '#ffffff' : 'var(--text-primary)',
                          fontSize: '13px',
                          maxWidth: '280px',
                          textAlign: 'left',
                          lineHeight: 1.4,
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        marginRight: isCustomer ? '32px' : '0',
                        marginLeft: isCustomer ? '0' : '32px',
                        marginTop: '2px',
                      }}
                    >
                      {msg.author} · {formattedTime}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        };

        return (
          <div key={comment.id} className="timeline-item">
            <div
              className="user-avatar"
              style={{ width: '32px', height: '32px', fontSize: '11px' }}
            >
              {authorName.slice(0, 2).toUpperCase()}
            </div>

            <div className={`timeline-card ${isInternal ? 'internal-note' : ''}`}>
              {isInternal && (
                <div className="internal-badge">
                  <Lock size={12} />
                  <span>PRIVATE INTERNAL NOTE (VISIBLE TO STAFF ONLY)</span>
                </div>
              )}

              <div className="timeline-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="author-name">{authorName}</span>
                  {!isInternal && (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Globe size={11} /> Public Reply
                    </span>
                  )}
                </div>
                <span className="timestamp">{formattedDate}</span>
              </div>

              <div className="timeline-body">
                {isTranscript ? renderTranscript() : <FormattedEmailContent text={comment.body} />}
              </div>

              {comment.attachments && comment.attachments.length > 0 && (
                <div
                  style={{
                    marginTop: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                >
                  {comment.attachments.map((att) => (
                    <AttachmentItem key={att.id} att={att} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
